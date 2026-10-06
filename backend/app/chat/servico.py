"""Chat: monta o contexto, conversa com a LLM e guarda as mensagens."""

import json
import logging
from collections.abc import AsyncIterator

from fastapi import HTTPException

from app.arquivos.armazenamento import CaminhoInvalido, caminho_seguro
from app.chat import anexos, llms, repositorio, tools
from app.chat.esquemas import MensagemEnviar, MensagemSaida
from app.chat.modelos import Mensagem
from app.criacoes import repositorio as repositorio_criacoes
from app.db import AbrirBanco, agora
from app.openrouter.chat import ErroOpenRouter, conversar_com_tools
from app.openrouter.transcricao import parte_de_audio, transcrever
from app.referencias import repositorio as repositorio_referencias
from app.referencias.modelos import Referencia
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
- Quando ele anexar imagens (prints, referências visuais) ou arquivos de texto (roteiros, código), \
use esse material como base: descreva o que vê, siga o roteiro e reproduza estilo, cores e textos.
- Os brolls precisam parecer reais: interfaces, código, terminais e mensagens de erro fiéis à \
realidade técnica, com texto legível e coerente. Escreva prompts detalhados (cena, enquadramento, \
luz, estilo, texto exato que aparece na tela).
- Os vídeos são publicados na vertical (9:16) e na horizontal (16:9). Use o formato pedido; se ele \
não disser, pergunte ou escolha vertical para Reels.
- Para mudar um broll, use ajustar_criacao com o criacao_id da versão que ele quer mudar (normalmente a \
mais recente). Se ela ainda é rascunho, o rascunho é editado; se já foi gerada, o app cria uma nova \
versão (v2, v3…) em rascunho, e a anterior continua guardada.
- Imagens da sessão podem ser usadas nas criações pelo parâmetro referencias: como 'referencia' (estilo \
ou conteúdo) ou, em vídeo, como 'primeiro_quadro'/'ultimo_quadro' (o vídeo começa ou termina \
exatamente nessa imagem). Para animar uma imagem, use-a como primeiro_quadro num modelo que aceite.
- Se uma ferramenta devolver erro, leia a mensagem, corrija os parâmetros e tente de novo.
- Você NUNCA gera imagens ou vídeos. Não existe ferramenta para isso e você não pode disparar uma \
geração. Se ele pedir para você gerar, explique que só ele pode clicar em Gerar no painel, e \
que o rascunho já está pronto para isso.
- Depois de preparar, diga em poucas palavras o que preparou e que ele pode revisar no painel e \
clicar em Gerar.
- Responda em português do Brasil, de forma direta e organizada."""

SEM_TEXTO = "Escreva uma mensagem ou grave um áudio antes de enviar."
# Formato de cada áudio aceito, como a OpenRouter espera em `input_audio.format`.
FORMATO_AUDIO_OPENROUTER = {"audio/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a"}


def listar_mensagens(banco, sessao_id: str) -> list[Mensagem]:
    return repositorio.listar(banco, sessao_id)


def _resumo_da_sessao(criacoes, referencias: list[Referencia]) -> str:
    linhas = []
    if criacoes:
        linhas.append("Criações desta sessão (mais recentes primeiro):")
        linhas += [json.dumps(tools.resumo_criacao(c), ensure_ascii=False) for c in criacoes[:30]]
    else:
        linhas.append("Criações desta sessão: nenhuma ainda.")
    if referencias:
        linhas.append("Referências desta sessão (arquivos que o usuário anexou ou imagens geradas usadas como base):")
        linhas += [
            json.dumps(
                {"referencia_id": r.id, "tipo": r.tipo, "origem": r.origem, "nome": r.nome_original},
                ensure_ascii=False,
            )
            for r in referencias
        ]
    return "\n".join(linhas)


def _ler_audio(referencia: Referencia) -> bytes:
    return caminho_seguro(referencia.arquivo).read_bytes()


def _conteudo_de_voz(mensagem: Mensagem, audio: Referencia | None, aceita_audio: bool) -> tuple[str, dict | None]:
    """(texto, parte de áudio): a LLM que entende áudio recebe o áudio; as outras, a transcrição."""
    texto = mensagem.texto or ""
    if audio is not None and aceita_audio:
        try:
            parte = parte_de_audio(_ler_audio(audio), FORMATO_AUDIO_OPENROUTER.get(audio.formato, "webm"))
            return texto or "(mensagem de voz)", parte
        except (CaminhoInvalido, OSError):
            log.warning("Não foi possível ler o áudio %s", audio.id)
    if mensagem.transcricao:
        voz = f"[Mensagem de voz, transcrita]: {mensagem.transcricao}"
        return f"{texto}\n\n{voz}" if texto else voz, None
    return texto, None


def _contexto(
    mensagens: list[Mensagem],
    criacoes,
    referencias: list[Referencia],
    aceita_imagem: bool,
    aceita_audio: bool,
) -> list[dict]:
    """Regra "Contexto da LLM": prompt de sistema, resumo das criações e referências, e as mensagens
    da sessão com os anexos de cada uma (imagens como imagem, textos no próprio texto, voz como
    áudio ou transcrição)."""
    contexto = [
        {"role": "system", "content": PROMPT_DE_SISTEMA},
        {"role": "system", "content": _resumo_da_sessao(criacoes, referencias)},
    ]
    por_id = {r.id: r for r in referencias}
    anexos_por_mensagem: dict[str, list[Referencia]] = {}
    for referencia in referencias:
        if referencia.mensagem_id and referencia.tipo != "audio":
            anexos_por_mensagem.setdefault(referencia.mensagem_id, []).append(referencia)

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

        if mensagem.autor == "usuario":
            audio = por_id.get(mensagem.audio_referencia_id) if mensagem.audio_referencia_id else None
            texto, parte_audio = _conteudo_de_voz(mensagem, audio, aceita_audio)
            if not texto and not parte_audio:
                continue
            conteudo = anexos.conteudo_do_usuario(texto, anexos_por_mensagem.get(mensagem.id, []), aceita_imagem)
            if parte_audio:
                conteudo = (conteudo if isinstance(conteudo, list) else [{"type": "text", "text": conteudo}]) + [
                    parte_audio
                ]
            contexto.append({"role": "user", "content": conteudo})
            continue

        texto = mensagem.texto or mensagem.transcricao
        if not texto:
            continue
        if mensagem.autor == "llm":
            contexto.append({"role": "assistant", "content": texto})
    return contexto


def _evento(tipo: str, dados: dict) -> str:
    return f"event: {tipo}\ndata: {json.dumps(dados, ensure_ascii=False, default=str)}\n\n"


def _montar_contexto(sessao_id: str, llm: str) -> list[dict]:
    with AbrirBanco() as banco:
        return _contexto(
            repositorio.listar(banco, sessao_id),
            repositorio_criacoes.listar(banco, sessao_id),
            repositorio_referencias.listar(banco, sessao_id),
            llms.aceita_imagem(banco, llm),
            llms.aceita_audio(banco, llm),
        )


def preparar_envio(sessao_id: str, dados: MensagemEnviar) -> tuple[str, Mensagem]:
    """Valida e salva a mensagem do usuário. Erros aqui viram resposta normal (não SSE)."""
    texto = (dados.texto or "").strip()
    if not texto and not dados.audio_referencia_id:
        raise HTTPException(status_code=422, detail=SEM_TEXTO)

    with AbrirBanco() as banco:
        sessao = repositorio_sessoes.buscar(banco, sessao_id)
        if sessao is None:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        # Anexos: todos precisam ser desta sessão.
        ids = list(dict.fromkeys(dados.referencia_ids))
        anexadas = repositorio_referencias.buscar_varias(banco, sessao_id, ids)
        if len(anexadas) != len(ids):
            raise HTTPException(status_code=400, detail="Um dos anexos não pertence a esta sessão.")

        # Áudio gravado: precisa ser desta sessão e ser áudio.
        if dados.audio_referencia_id:
            audios = repositorio_referencias.buscar_varias(banco, sessao_id, [dados.audio_referencia_id])
            if not audios or audios[0].tipo != "audio":
                raise HTTPException(status_code=400, detail="O áudio enviado não pertence a esta sessão.")
            anexadas = [*anexadas, audios[0]]

        mensagem = Mensagem(
            sessao_id=sessao_id,
            autor="usuario",
            texto=texto or None,
            audio_referencia_id=dados.audio_referencia_id,
            criada_em=agora(),
        )
        banco.add(mensagem)
        banco.flush()
        for referencia in anexadas:
            if referencia.mensagem_id is None:
                referencia.mensagem_id = mensagem.id
        sessao.ultimo_uso_em = mensagem.criada_em
        banco.commit()
        banco.refresh(mensagem)
        return sessao.llm, mensagem


async def _transcrever_se_preciso(mensagem: Mensagem, llm: str) -> str | None:
    """Se a LLM da sessão não entende áudio, transcreve antes e guarda na mensagem. Devolve a transcrição."""
    if not mensagem.audio_referencia_id or mensagem.transcricao:
        return None
    with AbrirBanco() as banco:
        if llms.aceita_audio(banco, llm):
            return None  # O áudio vai direto para a LLM.
        modelo = llms.modelo_de_transcricao(banco)
        audio = banco.get(Referencia, mensagem.audio_referencia_id)
    if modelo is None:
        raise ErroOpenRouter("Nenhum modelo de transcrição disponível. Defina FILLFRAME_MODELO_TRANSCRICAO no .env.")
    try:
        conteudo = _ler_audio(audio)
    except (CaminhoInvalido, OSError) as erro:
        raise ErroOpenRouter("Não foi possível ler o áudio gravado.") from erro

    transcricao = await transcrever(modelo, conteudo, FORMATO_AUDIO_OPENROUTER.get(audio.formato, "webm"))
    with AbrirBanco() as banco:
        salva = banco.get(Mensagem, mensagem.id)
        salva.transcricao = transcricao
        banco.commit()
    return transcricao


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


async def responder(sessao_id: str, llm: str, mensagem_usuario: Mensagem) -> AsyncIterator[str]:
    """Eventos SSE: `usuario` (mensagem salva), `transcricao` (texto do áudio, quando transcrito),
    `texto` (pedaços), `tool` (rascunho preparado ou ajustado), `fim` ou `erro`."""
    yield _evento("usuario", MensagemSaida.model_validate(mensagem_usuario).model_dump(mode="json"))

    try:
        transcricao = await _transcrever_se_preciso(mensagem_usuario, llm)
    except ErroOpenRouter as falha:
        yield _evento("erro", {"erro": f"Não foi possível transcrever o áudio. {falha}"})
        return
    if transcricao:
        yield _evento("transcricao", {"mensagem_id": mensagem_usuario.id, "transcricao": transcricao})

    contexto = _montar_contexto(sessao_id, llm)

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
        erro = "Algo deu errado no FillFrame. Detalhes no terminal do backend."
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
