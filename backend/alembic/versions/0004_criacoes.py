"""Criações (pedidos de imagem ou vídeo, com versões)

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-24
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "criacoes",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("sessao_id", sa.String(32), sa.ForeignKey("sessoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("versao_de_id", sa.String(32), sa.ForeignKey("criacoes.id"), nullable=True),
        sa.Column("raiz_id", sa.String(32), nullable=False),
        sa.Column("numero_versao", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("modelo", sa.String(200), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("orientacao", sa.String(12), nullable=False),
        sa.Column("proporcao", sa.String(12), nullable=True),
        sa.Column("duracao_segundos", sa.Integer(), nullable=True),
        sa.Column("resolucao", sa.String(20), nullable=True),
        sa.Column("parametros_extras", sa.JSON(), nullable=True),
        sa.Column("situacao", sa.String(10), nullable=False),
        sa.Column("id_job_openrouter", sa.String(200), nullable=True),
        sa.Column("erro", sa.Text(), nullable=True),
        sa.Column("estimativa_segundos", sa.Float(), nullable=True),
        sa.Column("iniciada_em", sa.DateTime(), nullable=True),
        sa.Column("concluida_em", sa.DateTime(), nullable=True),
        sa.Column("tempo_gasto_segundos", sa.Float(), nullable=True),
        sa.Column("custo_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("criada_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_criacoes_sessao_id", "criacoes", ["sessao_id"])
    op.create_index("ix_criacoes_raiz_id", "criacoes", ["raiz_id"])


def downgrade() -> None:
    op.drop_index("ix_criacoes_raiz_id", table_name="criacoes")
    op.drop_index("ix_criacoes_sessao_id", table_name="criacoes")
    op.drop_table("criacoes")
