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
