"""add organization tables

Revision ID: c3f1a2b4d5e6
Revises: b2e4f8c1d9a0
Create Date: 2026-06-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3f1a2b4d5e6'
down_revision = 'b2e4f8c1d9a0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)
    op.create_index('ix_organizations_owner_id', 'organizations', ['owner_id'])

    # org roles enum
    orgrole = sa.Enum('owner', 'admin', 'member', name='orgrole')
    orgrole.create(op.get_bind(), checkfirst=True)

    # organization_members
    op.create_table(
        'organization_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', orgrole, nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_organization_members_org_id', 'organization_members', ['org_id'])
    op.create_index('ix_organization_members_user_id', 'organization_members', ['user_id'])

    # org_invites
    op.create_table(
        'org_invites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=False),
        sa.Column('invited_by', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(255), nullable=False),
        sa.Column('is_accepted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_org_invites_token', 'org_invites', ['token'], unique=True)
    op.create_index('ix_org_invites_email', 'org_invites', ['email'])
    op.create_index('ix_org_invites_org_id', 'org_invites', ['org_id'])


def downgrade() -> None:
    op.drop_table('org_invites')
    op.drop_table('organization_members')
    op.drop_table('organizations')
    sa.Enum(name='orgrole').drop(op.get_bind(), checkfirst=True)
