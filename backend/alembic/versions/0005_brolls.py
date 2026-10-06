"""Brolls (arquivos prontos de cada criação)

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brolls",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("criacao_id", sa.String(32), sa.ForeignKey("criacoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("indice", sa.Integer(), nullable=False),
        sa.Column("arquivo", sa.String(500), nullable=False),
        sa.Column("formato", sa.String(50), nullable=False),
        sa.Column("largura", sa.Integer(), nullable=True),
        sa.Column("altura", sa.Integer(), nullable=True),
        sa.Column("duracao_segundos", sa.Float(), nullable=True),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=False),
        sa.Column("miniatura", sa.String(500), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_brolls_criacao_id", "brolls", ["criacao_id"])


def downgrade() -> None:
    op.drop_index("ix_brolls_criacao_id", table_name="brolls")
    op.drop_table("brolls")
