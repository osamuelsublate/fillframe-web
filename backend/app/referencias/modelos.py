from datetime import datetime
from uuid import uuid4

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, DataHoraUTC, agora


class Referencia(Base):
    """Imagem, texto ou áudio que serve de base para a conversa e para as criações."""

    __tablename__ = "referencias"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    sessao_id: Mapped[str] = mapped_column(String(32), ForeignKey("sessoes.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(10))  # imagem / texto / audio
    origem: Mapped[str] = mapped_column(String(10))  # anexada / gerada
    broll_origem_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("brolls.id", ondelete="SET NULL"))
    mensagem_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("mensagens.id", ondelete="SET NULL"), index=True
    )
    arquivo: Mapped[str] = mapped_column(String(500))  # relativo a backend/data/
    nome_original: Mapped[str | None] = mapped_column(String(255))
    formato: Mapped[str] = mapped_column(String(100))
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    criada_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)

    @property
    def url(self) -> str:
        return f"/api/arquivos/referencias/{self.id}"
