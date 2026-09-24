"""Regra "Estimar o tempo" (spec/telas.md e spec/arquitetura.md, seção 6).

A estimativa é a média de `tempo_gasto_segundos` das últimas 10 criações `pronto` do mesmo
modelo, preferindo as de mesmo tipo, duração e resolução. Sem histórico, usa um padrão por tipo.
"""

from statistics import mean

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.criacoes.modelos import Criacao

QUANTIDADE = 10
PADRAO_SEGUNDOS = {"imagem": 30.0, "video": 120.0}  # assumido na spec


def _prontas(banco: Session, modelo: str | None = None, tipo: str | None = None) -> list[Criacao]:
    consulta = select(Criacao).where(Criacao.situacao == "pronto", Criacao.tempo_gasto_segundos.is_not(None))
    if modelo:
        consulta = consulta.where(Criacao.modelo == modelo)
    if tipo:
        consulta = consulta.where(Criacao.tipo == tipo)
    return list(banco.scalars(consulta.order_by(Criacao.concluida_em.desc())))


def _media(criacoes: list[Criacao]) -> float | None:
    tempos = [c.tempo_gasto_segundos for c in criacoes[:QUANTIDADE]]
    return round(mean(tempos), 1) if tempos else None


def estimar(banco: Session, modelo: str, tipo: str, duracao: int | None, resolucao: str | None) -> float:
    prontas = _prontas(banco, modelo=modelo, tipo=tipo)
    parecidas = [c for c in prontas if c.duracao_segundos == duracao and c.resolucao == resolucao]
    for grupo in (parecidas, prontas):
        media = _media(grupo)
        if media is not None:
            return media
    return PADRAO_SEGUNDOS.get(tipo, 60.0)


def medias_por_modelo(banco: Session, tipo: str) -> dict[str, float]:
    """Tempo médio (últimas 10 prontas) de cada modelo que já tem histórico."""
    por_modelo: dict[str, list[Criacao]] = {}
    for criacao in _prontas(banco, tipo=tipo):
        por_modelo.setdefault(criacao.modelo, []).append(criacao)
    return {modelo: _media(criacoes) for modelo, criacoes in por_modelo.items()}
