"""Chat completions da OpenRouter com streaming (SSE) e tool calling."""

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from uuid import uuid4

import httpx

from app.openrouter.cliente import obter_cliente
from app.openrouter.erros import ErroOpenRouter, erro_de_conexao, erro_no_meio, mensagem_de_erro

# A resposta pode demorar a começar (modelos que pensam antes de responder).
TEMPO_LIMITE = httpx.Timeout(connect=15.0, read=300.0, write=30.0, pool=15.0)
MAXIMO_DE_RODADAS = 8

# Executa uma tool: recebe (nome, argumentos em JSON) e devolve (resultado para a LLM, evento para a tela ou None).
ExecutarTool = Callable[[str, str], Awaitable[tuple[str, dict | None]]]


async def conversar(modelo: str, mensagens: list[dict], tools: list[dict] | None = None) -> AsyncIterator[dict]:
    """Uma rodada: devolve {"tipo": "texto", ...} aos poucos e, no fim, os pedidos de tool completos
    ({"tipo": "tool_calls", "chamadas": [{"id", "nome", "argumentos"}]}), se houver."""
    corpo: dict = {"model": modelo, "messages": mensagens, "stream": True}
    if tools:
        corpo["tools"] = tools

    # Os pedidos de tool chegam em pedaços, identificados pelo índice.
    chamadas: dict[int, dict] = {}
    try:
        async with obter_cliente().stream("POST", "/chat/completions", json=corpo, timeout=TEMPO_LIMITE) as resposta:
            if resposta.status_code != 200:
                raise ErroOpenRouter(mensagem_de_erro(await resposta.aread(), resposta.status_code))

            async for linha in resposta.aiter_lines():
                # Linhas que começam com ":" são comentários de "ainda processando".
                if not linha.startswith("data:"):
                    continue
                dados = linha[5:].strip()
                if dados == "[DONE]":
                    break
                try:
                    pedaco = json.loads(dados)
                except ValueError:
                    continue

                if pedaco.get("error"):
                    raise ErroOpenRouter(erro_no_meio(pedaco["error"]))

                for escolha in pedaco.get("choices") or []:
                    delta = escolha.get("delta") or {}
                    if delta.get("content"):
                        yield {"tipo": "texto", "texto": delta["content"]}
                    for fragmento in delta.get("tool_calls") or []:
                        atual = chamadas.setdefault(
                            fragmento.get("index", len(chamadas)), {"id": None, "nome": "", "argumentos": ""}
                        )
                        if fragmento.get("id"):
                            atual["id"] = fragmento["id"]
                        funcao = fragmento.get("function") or {}
                        if funcao.get("name"):
                            atual["nome"] += funcao["name"]
                        if funcao.get("arguments"):
                            atual["argumentos"] += funcao["arguments"]
    except httpx.HTTPError as erro:
        raise erro_de_conexao(erro) from erro

    if chamadas:
        lista = [chamadas[i] for i in sorted(chamadas)]
        for chamada in lista:
            chamada["id"] = chamada["id"] or f"chamada_{uuid4().hex[:12]}"
        yield {"tipo": "tool_calls", "chamadas": lista}


async def conversar_com_tools(
    modelo: str, mensagens: list[dict], tools: list[dict], executar: ExecutarTool
) -> AsyncIterator[dict]:
    """Laço de tool calling: a LLM pede uma tool, o backend executa e devolve, e a LLM continua.

    Eventos: `texto` (pedaços), `tool` (uma tool executada), `rodada_tools` (fim de uma rodada com
    tools, para salvar) e `resposta_final` (texto da última rodada). No máximo 8 rodadas por mensagem.
    """
    historico = list(mensagens)
    for _ in range(MAXIMO_DE_RODADAS):
        partes: list[str] = []
        pedidas: list[dict] = []
        async for evento in conversar(modelo, historico, tools):
            if evento["tipo"] == "texto":
                partes.append(evento["texto"])
                yield evento
            elif evento["tipo"] == "tool_calls":
                pedidas = evento["chamadas"]

        texto = "".join(partes)
        if not pedidas:
            yield {"tipo": "resposta_final", "texto": texto}
            return

        historico.append(
            {
                "role": "assistant",
                "content": texto or None,
                "tool_calls": [
                    {"id": c["id"], "type": "function", "function": {"name": c["nome"], "arguments": c["argumentos"]}}
                    for c in pedidas
                ],
            }
        )
        executadas = []
        for chamada in pedidas:
            resultado, evento_tela = await executar(chamada["nome"], chamada["argumentos"])
            historico.append({"role": "tool", "tool_call_id": chamada["id"], "content": resultado})
            executada = {**chamada, "resultado": resultado, "evento": evento_tela}
            executadas.append(executada)
            yield {"tipo": "tool", **executada}
        yield {"tipo": "rodada_tools", "texto": texto, "chamadas": executadas}

    raise ErroOpenRouter(
        f"A LLM usou ferramentas {MAXIMO_DE_RODADAS} vezes seguidas sem terminar a resposta. "
        "Tente pedir de outro jeito."
    )
