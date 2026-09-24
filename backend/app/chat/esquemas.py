from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MensagemEnviar(BaseModel):
    texto: str | None = Field(default=None, max_length=50_000)
    audio_referencia_id: str | None = None  # áudio gravado (Referência do tipo audio)
    referencia_ids: list[str] = Field(default=[], max_length=20)


class MensagemSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    autor: str
    texto: str | None
    audio_referencia_id: str | None = None
    transcricao: str | None
    chamadas_de_tool: list[dict] | None = None
    criada_em: datetime


class Llm(BaseModel):
    id: str
    nome: str
    aceita_audio: bool
    aceita_imagem: bool
