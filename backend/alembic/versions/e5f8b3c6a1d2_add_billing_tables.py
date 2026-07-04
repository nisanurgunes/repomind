"""add billing tables

Revision ID: e5f8b3c6a1d2
Revises: d4e7a1b2c3f0
Create Date: 2026-07-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e5f8b3c6a1d2'
down_revision = 'd4e7a1b2c3f0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    plantype = postgresql.ENUM('free', 'pro', 'enterprise', name='plantype', create_type=False)

    # users.stripe_customer_id
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
    op.create_index('ix_users_stripe_customer_id', 'users', ['stripe_customer_id'], unique=True)

    # organizations.plan / organizations.stripe_customer_id
    op.add_column('organizations', sa.Column('plan', plantype, nullable=False, server_default='free'))
    op.add_column('organizations', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
    op.create_index('ix_organizations_stripe_customer_id', 'organizations', ['stripe_customer_id'], unique=True)

    # subscriptions
    billingownertype = sa.Enum('user', 'organization', name='billingownertype')
    billingownertype.create(op.get_bind(), checkfirst=True)
    subscriptionstatus = sa.Enum('active', 'past_due', 'canceled', 'incomplete', name='subscriptionstatus')
    subscriptionstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_type', postgresql.ENUM('user', 'organization', name='billingownertype', create_type=False), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(255), nullable=False),
        sa.Column('stripe_price_id', sa.String(255), nullable=False),
        sa.Column('status', postgresql.ENUM('active', 'past_due', 'canceled', 'incomplete', name='subscriptionstatus', create_type=False), nullable=False),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])
    op.create_index('ix_subscriptions_org_id', 'subscriptions', ['org_id'])
    op.create_index('ix_subscriptions_stripe_subscription_id', 'subscriptions', ['stripe_subscription_id'], unique=True)

    # usage_events
    op.create_table(
        'usage_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('org_id', sa.Integer(), nullable=True),
        sa.Column('feature', sa.String(50), nullable=False),
        sa.Column('repo_full_name', sa.String(511), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_usage_events_user_id', 'usage_events', ['user_id'])
    op.create_index('ix_usage_events_org_id', 'usage_events', ['org_id'])
    op.create_index('ix_usage_events_created_at', 'usage_events', ['created_at'])


def downgrade() -> None:
    op.drop_table('usage_events')
    op.drop_table('subscriptions')
    sa.Enum(name='subscriptionstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='billingownertype').drop(op.get_bind(), checkfirst=True)
    op.drop_index('ix_organizations_stripe_customer_id', table_name='organizations')
    op.drop_column('organizations', 'stripe_customer_id')
    op.drop_column('organizations', 'plan')
    op.drop_index('ix_users_stripe_customer_id', table_name='users')
    op.drop_column('users', 'stripe_customer_id')
