from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.modelos.modelos import ModeloCatalogo


def listar(banco: Session, categoria: str) -> list[ModeloCatalogo]:
    return list(banco.scalars(select(ModeloCatalogo).where(ModeloCatalogo.categoria == categoria)))


def ultima_atualizacao(banco: Session) -> datetime | None:
    return banco.scalar(select(func.min(ModeloCatalogo.atualizado_em)))


def substituir_tudo(banco: Session, modelos: list[ModeloCatalogo]) -> None:
    """Troca o catálogo inteiro numa transação só: ou tudo muda, ou nada muda."""
    banco.execute(delete(ModeloCatalogo))
    banco.add_all(modelos)
    banco.commit()
