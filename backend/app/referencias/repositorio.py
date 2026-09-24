from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.chat.modelos import Mensagem
from app.criacoes.modelos import CriacaoReferencia
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


def usada_em_criacao(banco: Session, referencia_id: str) -> bool:
    consulta = select(func.count()).where(CriacaoReferencia.referencia_id == referencia_id)
    return banco.scalar(consulta) > 0


def audio_de_mensagem(banco: Session, referencia_id: str) -> bool:
    return banco.scalar(select(func.count()).where(Mensagem.audio_referencia_id == referencia_id)) > 0


def apagar(banco: Session, referencia_id: str) -> None:
    banco.execute(delete(Referencia).where(Referencia.id == referencia_id))
    banco.commit()
