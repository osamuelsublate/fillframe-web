from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.criacoes.modelos import Criacao, CriacaoReferencia
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


def ids_das_criacoes(banco: Session, sessao_id: str) -> list[str]:
    return list(banco.scalars(select(Criacao.id).where(Criacao.sessao_id == sessao_id)))


def apagar(banco: Session, sessao_id: str) -> None:
    """Apaga a sessão e tudo dela no banco, numa transação só.

    Primeiro as ligações criação↔referência (a referência usada é protegida contra exclusão
    solta); depois a sessão, e o banco apaga em cascata mensagens, referências, criações e brolls.
    """
    criacoes_da_sessao = select(Criacao.id).where(Criacao.sessao_id == sessao_id)
    banco.execute(delete(CriacaoReferencia).where(CriacaoReferencia.criacao_id.in_(criacoes_da_sessao)))
    banco.execute(delete(Sessao).where(Sessao.id == sessao_id))
    banco.commit()
