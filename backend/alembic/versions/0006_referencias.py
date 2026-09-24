"""Referências (imagens, textos e áudios anexados ou imagens geradas usadas como base)

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "referencias",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("sessao_id", sa.String(32), sa.ForeignKey("sessoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("origem", sa.String(10), nullable=False),
        sa.Column("broll_origem_id", sa.String(32), sa.ForeignKey("brolls.id", ondelete="SET NULL"), nullable=True),
        sa.Column("mensagem_id", sa.String(32), sa.ForeignKey("mensagens.id", ondelete="SET NULL"), nullable=True),
        sa.Column("arquivo", sa.String(500), nullable=False),
        sa.Column("nome_original", sa.String(255), nullable=True),
        sa.Column("formato", sa.String(100), nullable=False),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=False),
        sa.Column("criada_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_referencias_sessao_id", "referencias", ["sessao_id"])
    op.create_index("ix_referencias_mensagem_id", "referencias", ["mensagem_id"])


def downgrade() -> None:
    op.drop_index("ix_referencias_mensagem_id", table_name="referencias")
    op.drop_index("ix_referencias_sessao_id", table_name="referencias")
    op.drop_table("referencias")
