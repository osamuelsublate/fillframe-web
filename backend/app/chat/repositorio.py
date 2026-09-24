from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat.modelos import Mensagem


def listar(banco: Session, sessao_id: str) -> list[Mensagem]:
    consulta = (
        select(Mensagem)
        .where(Mensagem.sessao_id == sessao_id)
        .order_by(Mensagem.criada_em, Mensagem.id)
    )
    return list(banco.scalars(consulta))


def salvar(banco: Session, mensagem: Mensagem) -> Mensagem:
    banco.add(mensagem)
    banco.commit()
    banco.refresh(mensagem)
    return mensagem
