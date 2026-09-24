from sqlalchemy import select
from sqlalchemy.orm import Session

from app.criacoes.modelos import Criacao


def listar(banco: Session, sessao_id: str, situacoes: list[str] | None = None) -> list[Criacao]:
    consulta = select(Criacao).where(Criacao.sessao_id == sessao_id)
    if situacoes:
        consulta = consulta.where(Criacao.situacao.in_(situacoes))
    return list(banco.scalars(consulta.order_by(Criacao.criada_em.desc(), Criacao.id)))


def buscar(banco: Session, sessao_id: str, criacao_id: str) -> Criacao | None:
    """Sempre pela sessão: uma criação de outra sessão não é encontrada."""
    consulta = select(Criacao).where(Criacao.id == criacao_id, Criacao.sessao_id == sessao_id)
    return banco.scalar(consulta)


def salvar(banco: Session, criacao: Criacao) -> Criacao:
    banco.add(criacao)
    banco.commit()
    banco.refresh(criacao)
    return criacao
