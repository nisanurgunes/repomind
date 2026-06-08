"""add notifications table

Revision ID: b2e4f8c1d9a0
Revises: a5c3313f58c4
Create Date: 2026-06-09 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2e4f8c1d9a0'
down_revision: Union[str, None] = 'a5c3313f58c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('repo_id', sa.Integer(), sa.ForeignKey('repos.id'), nullable=False),
        sa.Column('type', sa.Enum('new_commit', 'score_drop', 'new_pr', name='notificationtype'), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('notifications')
    op.execute("DROP TYPE IF EXISTS notificationtype")
