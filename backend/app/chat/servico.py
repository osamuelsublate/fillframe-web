"""Chat: monta o contexto, conversa com a LLM e guarda as mensagens."""

import json
import logging
from collections.abc import AsyncIterator

from fastapi import HTTPException

from app.chat import repositorio, tools
from app.chat.esquemas import MensagemEnviar, MensagemSaida
from app.chat.modelos import Mensagem
from app.db import AbrirBanco, agora
from app.criacoes import repositorio as repositorio_criacoes
from app.openrouter.chat import ErroOpenRouter, conversar_com_tools
from app.sessoes import repositorio as repositorio_sessoes

log = logging.getLogger("fillframe")

PROMPT_DE_SISTEMA = """Você é o diretor de brolls do FillFrame. Você ajuda o Samuel, criador de \
conteúdo de programação da Asimov Academy (Instagram com quase 100 mil seguidores), a planejar \
e preparar brolls para os vídeos dele: takes de aplicativos, erros que acontecem nos apps, \
diagramas que explicam conceitos e exemplos que parecem reais.

Como trabalhar:
- Entenda o conteúdo que ele vai gravar e o que cada trecho do vídeo precisa mostrar.
- Quando ele pedir brolls, prepare cada um com a ferramenta preparar_criacao (um rascunho por broll). \
Antes, use listar_modelos para escolher um modelo que aceite o formato e a duração certos. Prefira \
modelos com bom custo-benefício (ex.: 720p para vídeo) a menos que ele peça qualidade máxima.
- Os brolls precisam parecer reais: interfaces, código, terminais e mensagens de erro fiéis à \
realidade técnica, com texto legível e coerente. Escreva prompts detalhados (cena, enquadramento, \
luz, estilo, texto exato que aparece na tela).
- Os vídeos são publicados na vertical (9:16) e na horizontal (16:9). Use o formato pedido; se ele \
não disser, pergunte ou escolha vertical para Reels.
- Para mudar um rascunho que ainda não foi gerado, use ajustar_criacao com o criacao_id.
- Se uma ferramenta devolver erro, leia a mensagem, corrija os parâmetros e tente de novo.
- Você NUNCA gera imagens ou vídeos. Não existe ferramenta para isso e você não pode disparar uma \
geração. Se ele pedir para você gerar, explique que só ele pode clicar em Gerar no painel, e \
que o rascunho já está pronto para isso.
- Depois de preparar, diga em poucas palavras o que preparou e que ele pode revisar no painel e \
clicar em Gerar.
- Responda em português do Brasil, de forma direta e organizada."""

SEM_TEXTO = "Escreva uma mensagem antes de enviar."


def listar_mensagens(banco, sessao_id: str) -> list[Mensagem]:
    return repositorio.listar(banco, sessao_id)


def _resumo_das_criacoes(criacoes) -> str:
    if not criacoes:
        return "Criações desta sessão: nenhuma ainda."
    linhas = ["Criações desta sessão (mais recentes primeiro):"]
    for criacao in criacoes[:30]:
        linhas.append(json.dumps(tools.resumo_criacao(criacao), ensure_ascii=False))
    return "\n".join(linhas)


def _contexto(mensagens: list[Mensagem], criacoes) -> list[dict]:
    """Regra "Contexto da LLM": prompt de sistema, resumo das criações e mensagens da sessão
    (as referências entram na fase 4)."""
    contexto = [
        {"role": "system", "content": PROMPT_DE_SISTEMA},
        {"role": "system", "content": _resumo_das_criacoes(criacoes)},
    ]
    for mensagem in mensagens:
        if mensagem.autor == "tool":
            # Uma rodada em que a LLM usou ferramentas: o pedido e o resultado de cada uma.
            chamadas = mensagem.chamadas_de_tool or []
            if not chamadas:
                continue
            contexto.append(
                {
                    "role": "assistant",
                    "content": mensagem.texto or None,
                    "tool_calls": [
                        {
                            "id": c["id"],
                            "type": "function",
                            "function": {"name": c["nome"], "arguments": c["argumentos"]},
                        }
                        for c in chamadas
                    ],
                }
            )
            for c in chamadas:
                contexto.append({"role": "tool", "tool_call_id": c["id"], "content": c["resultado"]})
            continue

        texto = mensagem.texto or mensagem.transcricao
        if not texto:
            continue
        if mensagem.autor == "usuario":
            contexto.append({"role": "user", "content": texto})
        elif mensagem.autor == "llm":
            contexto.append({"role": "assistant", "content": texto})
    return contexto


def _evento(tipo: str, dados: dict) -> str:
    return f"event: {tipo}\ndata: {json.dumps(dados, ensure_ascii=False, default=str)}\n\n"


def preparar_envio(sessao_id: str, dados: MensagemEnviar) -> tuple[str, list[dict], Mensagem]:
    """Valida, salva a mensagem do usuário e monta o contexto. Erros aqui viram resposta normal (não SSE)."""
    texto = (dados.texto or "").strip()
    if not texto:
        raise HTTPException(status_code=422, detail=SEM_TEXTO)

    with AbrirBanco() as banco:
        sessao = repositorio_sessoes.buscar(banco, sessao_id)
        if sessao is None:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        mensagem = Mensagem(sessao_id=sessao_id, autor="usuario", texto=texto, criada_em=agora())
        banco.add(mensagem)
        sessao.ultimo_uso_em = mensagem.criada_em
        banco.commit()
        banco.refresh(mensagem)

        contexto = _contexto(repositorio.listar(banco, sessao_id), repositorio_criacoes.listar(banco, sessao_id))
        return sessao.llm, contexto, mensagem


def _salvar(sessao_id: str, autor: str, texto: str | None, chamadas: list[dict] | None = None) -> Mensagem:
    with AbrirBanco() as banco:
        mensagem = repositorio.salvar(
            banco,
            Mensagem(sessao_id=sessao_id, autor=autor, texto=texto, chamadas_de_tool=chamadas, criada_em=agora()),
        )
        sessao = repositorio_sessoes.buscar(banco, sessao_id)
        if sessao is not None:
            sessao.ultimo_uso_em = mensagem.criada_em
            banco.commit()
        return mensagem


async def responder(sessao_id: str, llm: str, contexto: list[dict], mensagem_usuario: Mensagem) -> AsyncIterator[str]:
    """Eventos SSE: `usuario` (mensagem salva), `texto` (pedaços), `tool` (rascunho preparado ou
    ajustado), `fim` ou `erro`."""
    yield _evento("usuario", MensagemSaida.model_validate(mensagem_usuario).model_dump(mode="json"))

    async def executar(nome: str, argumentos: str):
        return await tools.executar(sessao_id, nome, argumentos)

    partes: list[str] = []  # texto da rodada atual
    resposta: Mensagem | None = None
    erro: str | None = None
    try:
        async for evento in conversar_com_tools(llm, contexto, tools.DEFINICOES, executar):
            if evento["tipo"] == "texto":
                partes.append(evento["texto"])
                yield _evento("texto", {"texto": evento["texto"]})
            elif evento["tipo"] == "tool" and evento["evento"]:
                yield _evento("tool", evento["evento"])
            elif evento["tipo"] == "rodada_tools":
                # Guarda a rodada assim que termina: o que a LLM disse, o que pediu e o que recebeu.
                chamadas = [
                    {
                        "id": c["id"],
                        "nome": c["nome"],
                        "argumentos": c["argumentos"],
                        "resultado": c["resultado"],
                        **(c["evento"] or {}),
                    }
                    for c in evento["chamadas"]
                ]
                _salvar(sessao_id, "tool", evento["texto"].strip() or None, chamadas)
                partes = []
            elif evento["tipo"] == "resposta_final":
                texto = evento["texto"].strip()
                partes = []
                if texto:
                    resposta = _salvar(sessao_id, "llm", texto)
    except ErroOpenRouter as falha:
        erro = str(falha)
    except Exception:
        log.exception("Erro inesperado no chat")
        erro = "Erro inesperado ao falar com a LLM."
    finally:
        # Guarda o que chegou da rodada interrompida, mesmo se a conexão caiu no meio.
        texto = "".join(partes).strip()
        if texto:
            resposta = _salvar(sessao_id, "llm", texto)

    if erro:
        yield _evento("erro", {"erro": erro})
    else:
        saida = MensagemSaida.model_validate(resposta).model_dump(mode="json") if resposta else None
        yield _evento("fim", {"mensagem": saida})
