from datetime import datetime
from uuid import uuid4

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, DataHoraUTC, agora


def novo_id() -> str:
    return uuid4().hex


class Sessao(Base):
    __tablename__ = "sessoes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=novo_id)
    nome: Mapped[str] = mapped_column(String(120))
    llm: Mapped[str] = mapped_column(String(200))
    criada_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)
    ultimo_uso_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora, index=True)
