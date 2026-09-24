"""Rotas de situação do app."""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import obter_config
from app.db import obter_banco
from app.modelos import servico as servico_modelos
from app.openrouter.cliente import verificar_chave

rotas = APIRouter(prefix="/api", tags=["sistema"])


class Status(BaseModel):
    chave_configurada: bool
    chave_valida: bool
    catalogo_atualizado_em: datetime | None = None


@rotas.get("/status", response_model=Status)
async def status(banco: Session = Depends(obter_banco)) -> Status:
    configurada = obter_config().chave_configurada
    valida = await verificar_chave() if configurada else False
    return Status(
        chave_configurada=configurada,
        chave_valida=valida,
        catalogo_atualizado_em=servico_modelos.ultima_atualizacao(banco),
    )
