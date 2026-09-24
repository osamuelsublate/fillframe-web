from sqlalchemy import select
from sqlalchemy.orm import Session

from app.referencias.modelos import Referencia


def listar(banco: Session, sessao_id: str) -> list[Referencia]:
    consulta = select(Referencia).where(Referencia.sessao_id == sessao_id).order_by(Referencia.criada_em)
    return list(banco.scalars(consulta))


def buscar_varias(banco: Session, sessao_id: str, ids: list[str]) -> list[Referencia]:
    """Só devolve as que são desta sessão."""
    if not ids:
        return []
    consulta = select(Referencia).where(Referencia.sessao_id == sessao_id, Referencia.id.in_(ids))
    return list(banco.scalars(consulta))


def salvar(banco: Session, referencia: Referencia) -> Referencia:
    banco.add(referencia)
    banco.commit()
    banco.refresh(referencia)
    return referencia
