"""Referências usadas em cada criação (com o papel: referência, primeiro ou último quadro)

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "criacao_referencias",
        sa.Column("criacao_id", sa.String(32), sa.ForeignKey("criacoes.id", ondelete="CASCADE"), primary_key=True),
        # RESTRICT: uma referência usada numa criação não pode sumir (a versão precisa continuar reproduzível).
        sa.Column(
            "referencia_id", sa.String(32), sa.ForeignKey("referencias.id", ondelete="RESTRICT"), primary_key=True
        ),
        sa.Column("papel", sa.String(20), primary_key=True),
    )
    op.create_index("ix_criacao_referencias_referencia_id", "criacao_referencias", ["referencia_id"])


def downgrade() -> None:
    op.drop_index("ix_criacao_referencias_referencia_id", table_name="criacao_referencias")
    op.drop_table("criacao_referencias")
