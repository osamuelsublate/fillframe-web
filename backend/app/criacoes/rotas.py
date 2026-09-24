"""Rotas das criações (sempre dentro de uma sessão)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.criacoes import servico
from app.criacoes.esquemas import CriacaoAlterar, CriacaoCriar, CriacaoSaida
from app.db import obter_banco

rotas = APIRouter(prefix="/api/sessoes/{sessao_id}/criacoes", tags=["criacoes"])


@rotas.get("", response_model=list[CriacaoSaida])
def listar(sessao_id: str, situacao: str | None = None, banco: Session = Depends(obter_banco)):
    return servico.listar(banco, sessao_id, situacao)


@rotas.post("", response_model=CriacaoSaida, status_code=201)
def criar(sessao_id: str, dados: CriacaoCriar, banco: Session = Depends(obter_banco)):
    return servico.criar(banco, sessao_id, dados)


@rotas.post("/{criacao_id}/gerar", response_model=CriacaoSaida)
async def gerar(sessao_id: str, criacao_id: str, banco: Session = Depends(obter_banco)):
    # async: o executor precisa do loop de eventos do servidor para rodar em segundo plano.
    return servico.gerar(banco, sessao_id, criacao_id)


@rotas.patch("/{criacao_id}", response_model=CriacaoSaida)
def alterar(sessao_id: str, criacao_id: str, dados: CriacaoAlterar, banco: Session = Depends(obter_banco)):
    return servico.alterar(banco, sessao_id, criacao_id, dados)


@rotas.post("/{criacao_id}/versoes", response_model=CriacaoSaida, status_code=201)
def nova_versao(
    sessao_id: str, criacao_id: str, dados: CriacaoAlterar | None = None, banco: Session = Depends(obter_banco)
):
    return servico.nova_versao(banco, sessao_id, criacao_id, dados or CriacaoAlterar())


@rotas.get("/{criacao_id}/versoes", response_model=list[CriacaoSaida])
def versoes(sessao_id: str, criacao_id: str, banco: Session = Depends(obter_banco)):
    return servico.versoes(banco, sessao_id, criacao_id)


@rotas.delete("/{criacao_id}", status_code=204)
async def apagar(sessao_id: str, criacao_id: str, banco: Session = Depends(obter_banco)):
    # async: parar o acompanhamento de uma geração precisa acontecer no loop de eventos do servidor.
    servico.apagar(banco, sessao_id, criacao_id)
    return Response(status_code=204)
