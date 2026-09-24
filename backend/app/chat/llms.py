"""LLMs permitidas no chat (vêm do .env, resolvidas pelo catálogo)."""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import obter_config
from app.modelos import servico as servico_modelos
from app.modelos.modelos import ModeloCatalogo


def ids_permitidos(banco: Session) -> list[str]:
    """Ids reais das LLMs permitidas ("minimax:ultimo" vira o id do modelo mais novo da MiniMax)."""
    ids = []
    for llm in obter_config().llms_permitidas:
        resolvido = servico_modelos.resolver_llm(banco, llm)
        if resolvido and resolvido not in ids:
            ids.append(resolvido)
    return ids


def listar(banco: Session) -> list[dict]:
    catalogo: dict[str, ModeloCatalogo] = {m.id: m for m in servico_modelos.listar(banco, "llm")}
    llms = []
    for llm_id in ids_permitidos(banco):
        modelo = catalogo.get(llm_id)
        capacidades = modelo.capacidades if modelo else {}
        llms.append(
            {
                "id": llm_id,
                "nome": modelo.nome if modelo else llm_id,
                "aceita_audio": bool(capacidades.get("aceita_audio")),
                "aceita_imagem": bool(capacidades.get("aceita_imagem")),
            }
        )
    return llms


def validar(banco: Session, llm: str) -> str:
    """Devolve o id real da LLM, ou recusa se ela não está entre as permitidas."""
    resolvido = servico_modelos.resolver_llm(banco, llm.strip())
    if resolvido is None:
        raise HTTPException(
            status_code=422,
            detail="A lista de modelos da OpenRouter ainda não carregou. Tente de novo em instantes.",
        )
    if resolvido not in ids_permitidos(banco) and resolvido not in obter_config().llms_permitidas:
        raise HTTPException(status_code=422, detail="Essa LLM não está entre as permitidas")
    return resolvido


def aceita_imagem(banco: Session, llm_id: str) -> bool:
    for modelo in servico_modelos.listar(banco, "llm"):
        if modelo.id == llm_id:
            return bool(modelo.capacidades.get("aceita_imagem"))
    return False


def aceita_audio(banco: Session, llm_id: str) -> bool:
    for modelo in servico_modelos.listar(banco, "llm"):
        if modelo.id == llm_id:
            return bool(modelo.capacidades.get("aceita_audio"))
    return False


def modelo_de_transcricao(banco: Session) -> str | None:
    """FILLFRAME_MODELO_TRANSCRICAO, se estiver no .env. Senão, um modelo do catálogo que entende áudio:
    o Gemini Flash Lite mais novo (rápido, barato e testado com o áudio que o navegador grava; o
    Gemini Flash "normal" às vezes corta a transcrição por filtro); depois outro Gemini Flash; na
    falta deles, o primeiro modelo com áudio do catálogo (*assumido*)."""
    configurado = obter_config().fillframe_modelo_transcricao.strip()
    if configurado:
        return configurado
    com_audio = [
        m
        for m in servico_modelos.listar(banco, "llm")  # já vem do mais novo para o mais antigo
        if m.capacidades.get("aceita_audio") and ":" not in m.id and not m.id.startswith("openrouter/")
    ]
    gemini_flash = [m for m in com_audio if m.id.startswith("google/gemini") and "flash" in m.id]
    flash_lite = [m for m in gemini_flash if "lite" in m.id]
    escolhido = (flash_lite or gemini_flash or com_audio or [None])[0]
    return escolhido.id if escolhido else None
