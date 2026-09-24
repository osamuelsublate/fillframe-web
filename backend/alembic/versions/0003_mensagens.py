"""Mensagens do chat

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mensagens",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column(
            "sessao_id",
            sa.String(32),
            sa.ForeignKey("sessoes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("autor", sa.String(10), nullable=False),
        sa.Column("texto", sa.Text(), nullable=True),
        # Sem chave estrangeira: recriar a tabela no SQLite desligaria os anexos. O serviço valida o áudio.
        sa.Column("audio_referencia_id", sa.String(32), nullable=True),
        sa.Column("transcricao", sa.Text(), nullable=True),
        sa.Column("chamadas_de_tool", sa.JSON(), nullable=True),
        sa.Column("criada_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_mensagens_sessao_id_criada_em", "mensagens", ["sessao_id", "criada_em"])


def downgrade() -> None:
    op.drop_index("ix_mensagens_sessao_id_criada_em", table_name="mensagens")
    op.drop_table("mensagens")
