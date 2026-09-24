from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.brolls.esquemas import BrollSaida

Tipo = Literal["imagem", "video"]
Orientacao = Literal["vertical", "horizontal"]


class ReferenciaUsada(BaseModel):
    id: str
    papel: Literal["referencia", "primeiro_quadro", "ultimo_quadro"] = "referencia"


class CriacaoCriar(BaseModel):
    tipo: Tipo
    modelo: str = Field(max_length=200)
    prompt: str = Field(default="", max_length=20_000)
    orientacao: Orientacao
    proporcao: str | None = Field(default=None, max_length=12)
    duracao: int | None = None
    resolucao: str | None = Field(default=None, max_length=20)
    parametros_extras: dict | None = None
    referencias: list[ReferenciaUsada] = []


class CriacaoAlterar(BaseModel):
    tipo: Tipo | None = None
    modelo: str | None = Field(default=None, max_length=200)
    prompt: str | None = Field(default=None, max_length=20_000)
    orientacao: Orientacao | None = None
    proporcao: str | None = Field(default=None, max_length=12)
    duracao: int | None = None
    resolucao: str | None = Field(default=None, max_length=20)
    parametros_extras: dict | None = None
    referencias: list[ReferenciaUsada] | None = None


class CriacaoSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sessao_id: str
    versao_de_id: str | None
    raiz_id: str
    numero_versao: int
    tipo: str
    modelo: str
    prompt: str
    orientacao: str
    proporcao: str | None
    duracao_segundos: int | None
    resolucao: str | None
    parametros_extras: dict | None
    situacao: str
    erro: str | None
    estimativa_segundos: float | None
    iniciada_em: datetime | None
    concluida_em: datetime | None
    tempo_gasto_segundos: float | None
    custo_usd: float | None
    criada_em: datetime
    brolls: list[BrollSaida] = []
