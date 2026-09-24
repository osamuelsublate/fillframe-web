from datetime import datetime

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, DataHoraUTC


class ModeloCatalogo(Base):
    """Cache do catálogo da OpenRouter (não é dado do usuário)."""

    __tablename__ = "catalogo_modelos"

    categoria: Mapped[str] = mapped_column(String(10), primary_key=True)  # llm / imagem / video
    id: Mapped[str] = mapped_column(String(200), primary_key=True)
    nome: Mapped[str] = mapped_column(String(300))
    descricao: Mapped[str] = mapped_column(Text)
    capacidades: Mapped[dict] = mapped_column(JSON)
    precos: Mapped[dict] = mapped_column(JSON)
    atualizado_em: Mapped[datetime] = mapped_column(DataHoraUTC)
