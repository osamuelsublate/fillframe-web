from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import JSON, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.brolls.modelos import Broll
from app.db import Base, DataHoraUTC, agora

SITUACOES = ("rascunho", "gerando", "pronto", "falhou", "apagado")


class CriacaoReferencia(Base):
    """Referência usada numa criação, com o papel que ela cumpre."""

    __tablename__ = "criacao_referencias"

    criacao_id: Mapped[str] = mapped_column(String(32), ForeignKey("criacoes.id", ondelete="CASCADE"), primary_key=True)
    referencia_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("referencias.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    papel: Mapped[str] = mapped_column(String(20), primary_key=True)  # referencia / primeiro_quadro / ultimo_quadro

    @property
    def id(self) -> str:
        return self.referencia_id


class Criacao(Base):
    __tablename__ = "criacoes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: uuid4().hex)
    sessao_id: Mapped[str] = mapped_column(String(32), ForeignKey("sessoes.id", ondelete="CASCADE"), index=True)
    versao_de_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("criacoes.id"))
    raiz_id: Mapped[str] = mapped_column(String(32), index=True)
    numero_versao: Mapped[int] = mapped_column(Integer)
    tipo: Mapped[str] = mapped_column(String(10))  # imagem / video
    modelo: Mapped[str] = mapped_column(String(200))
    prompt: Mapped[str] = mapped_column(Text)
    orientacao: Mapped[str] = mapped_column(String(12))  # vertical / horizontal
    proporcao: Mapped[str | None] = mapped_column(String(12))  # ex.: 9:16
    duracao_segundos: Mapped[int | None] = mapped_column(Integer)
    resolucao: Mapped[str | None] = mapped_column(String(20))
    parametros_extras: Mapped[dict | None] = mapped_column(JSON)
    situacao: Mapped[str] = mapped_column(String(10), default="rascunho")
    id_job_openrouter: Mapped[str | None] = mapped_column(String(200))
    erro: Mapped[str | None] = mapped_column(Text)
    estimativa_segundos: Mapped[float | None] = mapped_column(Float)
    iniciada_em: Mapped[datetime | None] = mapped_column(DataHoraUTC)
    concluida_em: Mapped[datetime | None] = mapped_column(DataHoraUTC)
    tempo_gasto_segundos: Mapped[float | None] = mapped_column(Float)
    custo_usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    criada_em: Mapped[datetime] = mapped_column(DataHoraUTC, default=agora)

    brolls: Mapped[list[Broll]] = relationship(
        order_by=Broll.indice,
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    referencias: Mapped[list[CriacaoReferencia]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
