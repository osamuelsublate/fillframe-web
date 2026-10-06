"""Cache do catálogo de modelos da OpenRouter

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalogo_modelos",
        sa.Column("categoria", sa.String(10), primary_key=True),
        sa.Column("id", sa.String(200), primary_key=True),
        sa.Column("nome", sa.String(300), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("capacidades", sa.JSON(), nullable=False),
        sa.Column("precos", sa.JSON(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("catalogo_modelos")
