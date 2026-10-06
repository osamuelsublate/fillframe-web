"""Conexão com o SQLite em backend/data/fillframe.db e migrações."""

from collections.abc import Iterator
from datetime import UTC, datetime

from alembic.config import Config as ConfigAlembic
from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from alembic import command
from app.config import PASTA_BACKEND

PASTA_DADOS = PASTA_BACKEND / "data"
CAMINHO_BANCO = PASTA_DADOS / "fillframe.db"

PASTA_DADOS.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{CAMINHO_BANCO}")


@event.listens_for(engine, "connect")
def _ativar_chaves_estrangeiras(conexao, _):
    cursor = conexao.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


AbrirBanco = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class DataHoraUTC(TypeDecorator):
    """Guarda em UTC e devolve sempre com fuso (o SQLite perde o fuso)."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, valor: datetime | None, _):
        if valor is None:
            return None
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=UTC)
        return valor.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, valor: datetime | None, _):
        return valor.replace(tzinfo=UTC) if valor is not None else None


def agora() -> datetime:
    return datetime.now(UTC)


def obter_banco() -> Iterator[Session]:
    """Dependência do FastAPI: uma sessão do banco por requisição."""
    with AbrirBanco() as banco:
        yield banco


def migrar() -> None:
    """Aplica as migrações pendentes (alembic upgrade head)."""
    config = ConfigAlembic()
    config.set_main_option("script_location", str(PASTA_BACKEND / "alembic"))
    command.upgrade(config, "head")
