"""add r2_key_mesh_alt to reconstructions

Revision ID: a3f9c1b27e4d
Revises: 6821a0b4c34c
Create Date: 2026-05-14 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f9c1b27e4d'
down_revision: Union[str, None] = '6821a0b4c34c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reconstructions",
        sa.Column("r2_key_mesh_alt", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reconstructions", "r2_key_mesh_alt")
