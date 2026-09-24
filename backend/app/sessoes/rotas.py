"""Rotas das sessões."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import obter_banco
from app.sessoes import servico
from app.sessoes.esquemas import SessaoAlterar, SessaoCompleta, SessaoCriar, SessaoResumo

rotas = APIRouter(prefix="/api/sessoes", tags=["sessoes"])


@rotas.get("", response_model=list[SessaoResumo])
def listar(banco: Session = Depends(obter_banco)):
    return servico.listar(banco)


@rotas.post("", response_model=SessaoCompleta, status_code=201)
def criar(dados: SessaoCriar, banco: Session = Depends(obter_banco)):
    return servico.criar(banco, dados)


@rotas.get("/{sessao_id}", response_model=SessaoCompleta)
def abrir(sessao_id: str, banco: Session = Depends(obter_banco)):
    return servico.abrir(banco, sessao_id)


@rotas.patch("/{sessao_id}", response_model=SessaoResumo)
def alterar(sessao_id: str, dados: SessaoAlterar, banco: Session = Depends(obter_banco)):
    return servico.alterar(banco, sessao_id, dados)


@rotas.delete("/{sessao_id}", status_code=204)
async def apagar(sessao_id: str, banco: Session = Depends(obter_banco)):
    # async: parar o acompanhamento das gerações precisa acontecer no loop de eventos do servidor.
    servico.apagar(banco, sessao_id)
    return Response(status_code=204)
