from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.chat.esquemas import MensagemSaida
from app.criacoes.esquemas import CriacaoSaida


class SessaoCriar(BaseModel):
    nome: str | None = Field(default=None, max_length=120)
    llm: str | None = None


class SessaoAlterar(BaseModel):
    nome: str | None = Field(default=None, max_length=120)
    llm: str | None = None


class SessaoResumo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    llm: str
    ultimo_uso_em: datetime


class SessaoCompleta(SessaoResumo):
    criada_em: datetime
    mensagens: list[MensagemSaida] = []
    criacoes: list[CriacaoSaida] = []
    # Referências entram aqui na fase 4.
