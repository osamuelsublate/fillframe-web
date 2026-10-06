from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.brolls.modelos import Broll
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


def versoes(banco: Session, sessao_id: str, raiz_id: str) -> list[Criacao]:
    consulta = (
        select(Criacao)
        .where(Criacao.sessao_id == sessao_id, Criacao.raiz_id == raiz_id)
        .order_by(Criacao.numero_versao)
    )
    return list(banco.scalars(consulta))


def maior_versao(banco: Session, sessao_id: str, raiz_id: str) -> int:
    consulta = select(func.max(Criacao.numero_versao)).where(Criacao.sessao_id == sessao_id, Criacao.raiz_id == raiz_id)
    return banco.scalar(consulta) or 0


def salvar(banco: Session, criacao: Criacao) -> Criacao:
    banco.add(criacao)
    banco.commit()
    banco.refresh(criacao)
    return criacao


def tem_filhas(banco: Session, criacao_id: str) -> bool:
    return banco.scalar(select(func.count()).where(Criacao.versao_de_id == criacao_id)) > 0


def arquivos_dos_brolls(banco: Session, criacao_id: str) -> list[str | None]:
    linhas = banco.execute(select(Broll.arquivo, Broll.miniatura).where(Broll.criacao_id == criacao_id))
    return [caminho for linha in linhas for caminho in linha]


def apagar_brolls(banco: Session, criacao_id: str) -> None:
    banco.execute(delete(Broll).where(Broll.criacao_id == criacao_id))


def apagar_fisicamente(banco: Session, criacao_id: str) -> None:
    """A criação some; o banco apaga em cascata os brolls e as ligações com referências."""
    banco.execute(delete(Criacao).where(Criacao.id == criacao_id))
