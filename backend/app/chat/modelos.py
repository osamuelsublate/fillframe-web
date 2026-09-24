from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, DataHoraUTC, agora


class Mensagem(Base):
    __tablename__ = "mensagens"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    sessao_id: Mapped[str] = mapped_column(String(32), ForeignKey("sessoes.id", ondelete="CASCADE"))
    autor: Mapped[str] = mapped_column(String(10))  # usuario / llm / tool
    texto: Mapped[str | None] = mapped_column(Text)
    # Sem chave estrangeira no banco (recriar a tabela no SQLite desligaria os anexos); o serviço valida.
    audio_referencia_id: Mapped[str | None] = mapped_column(String(32))
    transcricao: Mapped[str | None] = mapped_column(Text)
    chamadas_de_tool: Mapped[list[dict] | None] = mapped_column(JSON)  # rodada com tools: pedido e resultado
    criada_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)
