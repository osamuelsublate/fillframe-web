from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MensagemEnviar(BaseModel):
    texto: str | None = Field(default=None, max_length=50_000)
    # Áudio e referências entram na fase 4.
    audio_referencia_id: str | None = None
    referencia_ids: list[str] = []


class MensagemSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    autor: str
    texto: str | None
    transcricao: str | None
    chamadas_de_tool: list[dict] | None = None
    criada_em: datetime


class Llm(BaseModel):
    id: str
    nome: str
    aceita_audio: bool
    aceita_imagem: bool
