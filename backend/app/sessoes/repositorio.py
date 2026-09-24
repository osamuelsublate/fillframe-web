from sqlalchemy import select
from sqlalchemy.orm import Session

from app.sessoes.modelos import Sessao


def listar(banco: Session) -> list[Sessao]:
    return list(banco.scalars(select(Sessao).order_by(Sessao.ultimo_uso_em.desc())))


def buscar(banco: Session, sessao_id: str) -> Sessao | None:
    return banco.get(Sessao, sessao_id)


def salvar(banco: Session, sessao: Sessao) -> Sessao:
    banco.add(sessao)
    banco.commit()
    banco.refresh(sessao)
    return sessao
