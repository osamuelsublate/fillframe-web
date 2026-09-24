"""Regras de negócio das criações."""

from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.criacoes import estimativa, repositorio, validacao
from app.criacoes.esquemas import CriacaoAlterar, CriacaoCriar
from app.criacoes.modelos import SITUACOES, Criacao
from app.db import agora
from app.geracao import executor
from app.sessoes import repositorio as repositorio_sessoes


def _sessao(banco: Session, sessao_id: str):
    sessao = repositorio_sessoes.buscar(banco, sessao_id)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return sessao


def _criacao(banco: Session, sessao_id: str, criacao_id: str) -> Criacao:
    _sessao(banco, sessao_id)
    criacao = repositorio.buscar(banco, sessao_id, criacao_id)
    if criacao is None:
        raise HTTPException(status_code=404, detail="Criação não encontrada")
    return criacao


def listar(banco: Session, sessao_id: str, situacao: str | None = None) -> list[Criacao]:
    _sessao(banco, sessao_id)
    situacoes = [s.strip() for s in (situacao or "").split(",") if s.strip()]
    invalidas = [s for s in situacoes if s not in SITUACOES]
    if invalidas:
        raise HTTPException(status_code=400, detail=f"Situação desconhecida: {', '.join(invalidas)}")
    return repositorio.listar(banco, sessao_id, situacoes or None)


def criar(banco: Session, sessao_id: str, dados: CriacaoCriar) -> Criacao:
    sessao = _sessao(banco, sessao_id)
    campos = validacao.validar(
        banco,
        validacao.Config(
            tipo=dados.tipo,
            modelo=dados.modelo,
            prompt=dados.prompt,
            orientacao=dados.orientacao,
            proporcao=dados.proporcao,
            duracao=dados.duracao,
            resolucao=dados.resolucao,
            referencias=dados.referencias,
            explicitos=dados.model_fields_set,
            extras=dados.parametros_extras,
        ),
    )
    novo_id = uuid4().hex
    criacao = Criacao(
        id=novo_id,
        sessao_id=sessao_id,
        raiz_id=novo_id,
        numero_versao=1,
        situacao="rascunho",
        parametros_extras=dados.parametros_extras,
        criada_em=agora(),
        **campos,
    )
    sessao.ultimo_uso_em = criacao.criada_em
    return repositorio.salvar(banco, criacao)


def alterar(banco: Session, sessao_id: str, criacao_id: str, dados: CriacaoAlterar) -> Criacao:
    criacao = _criacao(banco, sessao_id, criacao_id)
    if criacao.situacao != "rascunho":
        raise HTTPException(status_code=409, detail="Só é possível editar um rascunho")

    enviados = dados.model_fields_set

    def valor(campo: str, atual):
        return getattr(dados, campo) if campo in enviados else atual

    campos = validacao.validar(
        banco,
        validacao.Config(
            tipo=valor("tipo", criacao.tipo),
            modelo=valor("modelo", criacao.modelo),
            prompt=valor("prompt", criacao.prompt),
            orientacao=valor("orientacao", criacao.orientacao),
            proporcao=valor("proporcao", criacao.proporcao),
            duracao=valor("duracao", criacao.duracao_segundos),
            resolucao=valor("resolucao", criacao.resolucao),
            referencias=valor("referencias", []) or [],
            explicitos=enviados,
            extras=valor("parametros_extras", criacao.parametros_extras),
        ),
    )
    for campo, novo in campos.items():
        setattr(criacao, campo, novo)
    if "parametros_extras" in enviados:
        criacao.parametros_extras = dados.parametros_extras
    return repositorio.salvar(banco, criacao)


def gerar(banco: Session, sessao_id: str, criacao_id: str) -> Criacao:
    """Regra "Gerar só com ação do usuário": única porta de entrada para uma geração."""
    criacao = _criacao(banco, sessao_id, criacao_id)
    if criacao.situacao != "rascunho":
        raise HTTPException(status_code=409, detail="Só é possível gerar um rascunho")
    # Revalida contra o catálogo atual: o modelo pode ter mudado desde que o rascunho foi salvo.
    campos = validacao.validar(
        banco,
        validacao.Config(
            tipo=criacao.tipo,
            modelo=criacao.modelo,
            prompt=criacao.prompt,
            orientacao=criacao.orientacao,
            proporcao=criacao.proporcao,
            duracao=criacao.duracao_segundos,
            resolucao=criacao.resolucao,
            referencias=[],
            explicitos={"proporcao", "resolucao", "duracao"},
            extras=criacao.parametros_extras,
        ),
    )

    # Troca rascunho → gerando numa operação só: dois cliques seguidos não geram duas vezes.
    momento = agora()
    estimativa_segundos = estimativa.estimar(
        banco, campos["modelo"], campos["tipo"], campos["duracao_segundos"], campos["resolucao"]
    )
    mudou = banco.execute(
        update(Criacao)
        .where(Criacao.id == criacao_id, Criacao.situacao == "rascunho")
        .values(
            situacao="gerando", iniciada_em=momento, estimativa_segundos=estimativa_segundos, erro=None, **campos
        )
    ).rowcount
    if not mudou:
        banco.rollback()
        raise HTTPException(status_code=409, detail="Só é possível gerar um rascunho")
    sessao = _sessao(banco, sessao_id)
    sessao.ultimo_uso_em = momento
    banco.commit()
    banco.refresh(criacao)

    executor.enfileirar(criacao_id)
    return criacao
