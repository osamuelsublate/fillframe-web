from datetime import datetime
from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, DataHoraUTC, agora


class Broll(Base):
    """O arquivo pronto de uma criação (uma criação pode ter vários)."""

    __tablename__ = "brolls"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    criacao_id: Mapped[str] = mapped_column(String(32), ForeignKey("criacoes.id", ondelete="CASCADE"), index=True)
    indice: Mapped[int] = mapped_column(Integer)
    arquivo: Mapped[str] = mapped_column(String(500))  # relativo a backend/data/
    formato: Mapped[str] = mapped_column(String(50))
    largura: Mapped[int | None] = mapped_column(Integer)
    altura: Mapped[int | None] = mapped_column(Integer)
    duracao_segundos: Mapped[float | None] = mapped_column(Float)
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    miniatura: Mapped[str | None] = mapped_column(String(500))
    criado_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)

    @property
    def url(self) -> str:
        return f"/api/arquivos/brolls/{self.id}"

    @property
    def url_miniatura(self) -> str:
        return f"/api/arquivos/brolls/{self.id}?miniatura=1"
