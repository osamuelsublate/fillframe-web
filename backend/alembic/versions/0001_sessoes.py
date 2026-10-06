"""Tabela de sessões

Revision ID: 0001
Revises:
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sessoes",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("llm", sa.String(200), nullable=False),
        sa.Column("criada_em", sa.DateTime(), nullable=False),
        sa.Column("ultimo_uso_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sessoes_ultimo_uso_em", "sessoes", ["ultimo_uso_em"])


def downgrade() -> None:
    op.drop_index("ix_sessoes_ultimo_uso_em", table_name="sessoes")
    op.drop_table("sessoes")
