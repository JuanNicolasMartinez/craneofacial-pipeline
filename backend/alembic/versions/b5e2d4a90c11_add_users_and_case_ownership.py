"""add users table and case ownership

Revision ID: b5e2d4a90c11
Revises: a3f9c1b27e4d
Create Date: 2026-05-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5e2d4a90c11'
down_revision: Union[str, None] = 'a3f9c1b27e4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Dev environment: existing cases have no owner. Drop them so user_id can
    # be NOT NULL without a backfill (agreed: clean DB).
    op.execute('DELETE FROM cases')

    op.add_column('cases', sa.Column('user_id', sa.Uuid(), nullable=False))
    op.create_foreign_key(
        op.f('fk_cases_user_id_users'), 'cases', 'users', ['user_id'], ['id']
    )
    op.create_index(op.f('ix_cases_user_id'), 'cases', ['user_id'])
    op.drop_column('cases', 'created_by')


def downgrade() -> None:
    op.add_column(
        'cases',
        sa.Column('created_by', sa.String(length=100), nullable=False,
                  server_default=''),
    )
    op.drop_index(op.f('ix_cases_user_id'), table_name='cases')
    op.drop_constraint(op.f('fk_cases_user_id_users'), 'cases', type_='foreignkey')
    op.drop_column('cases', 'user_id')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
