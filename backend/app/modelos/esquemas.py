from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ModeloMidia(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    descricao: str
    capacidades: dict
    precos: dict
    tempo_medio_segundos: float | None = None  # média das últimas 10 criações prontas (null sem histórico)


class CatalogoAtualizado(BaseModel):
    atualizado_em: datetime | None
