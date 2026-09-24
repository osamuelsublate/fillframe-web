from alembic import context

from app.db import Base, engine
from app.modelos import modelos as _catalogo  # noqa: F401  (registra as tabelas no Base)
from app.brolls import modelos as _brolls  # noqa: F401
from app.chat import modelos as _chat  # noqa: F401
from app.criacoes import modelos as _criacoes  # noqa: F401
from app.referencias import modelos as _referencias  # noqa: F401
from app.sessoes import modelos as _sessoes  # noqa: F401

alvo = Base.metadata

with engine.connect() as conexao:
    context.configure(connection=conexao, target_metadata=alvo, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
