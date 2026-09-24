from sqlalchemy import select
from sqlalchemy.orm import Session

from app.brolls.modelos import Broll
from app.criacoes.modelos import Criacao
from app.sessoes.modelos import Sessao


def galeria(
    banco: Session, sessao_id: str | None, tipo: str | None, orientacao: str | None
) -> list[tuple[Broll, Criacao, Sessao]]:
    """Brolls prontos (de criações que não foram apagadas), mais recentes primeiro."""
    consulta = (
        select(Broll, Criacao, Sessao)
        .join(Criacao, Broll.criacao_id == Criacao.id)
        .join(Sessao, Criacao.sessao_id == Sessao.id)
        .where(Criacao.situacao != "apagado")
    )
    if sessao_id:
        consulta = consulta.where(Criacao.sessao_id == sessao_id)
    if tipo:
        consulta = consulta.where(Criacao.tipo == tipo)
    if orientacao:
        consulta = consulta.where(Criacao.orientacao == orientacao)
    return [tuple(linha) for linha in banco.execute(consulta.order_by(Broll.criado_em.desc(), Broll.indice))]
