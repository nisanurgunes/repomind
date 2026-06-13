"""user id to uuid

Revision ID: d4e7a1b2c3f0
Revises: c3f1a2b4d5e6
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e7a1b2c3f0'
down_revision = 'c3f1a2b4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL'de uuid-ossp extension gerekli
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # 1. FK constraint'leri geçici olarak drop et
    op.drop_constraint('watchlist_user_id_fkey', 'watchlist', type_='foreignkey')
    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
    op.drop_constraint('saved_features_user_id_fkey', 'saved_features', type_='foreignkey')
    op.drop_constraint('user_repos_user_id_fkey', 'user_repos', type_='foreignkey')
    op.drop_constraint('organization_members_user_id_fkey', 'organization_members', type_='foreignkey')
    op.drop_constraint('org_invites_invited_by_fkey', 'org_invites', type_='foreignkey')

    # 2. users.id → UUID
    op.add_column('users', sa.Column('id_new', sa.Uuid(), nullable=True))
    op.execute('UPDATE users SET id_new = uuid_generate_v4()')
    op.execute('ALTER TABLE users ALTER COLUMN id_new SET NOT NULL')

    # 3. Child tablolara UUID kolonları ekle
    for table in ['watchlist', 'notifications', 'saved_features', 'user_repos', 'organization_members']:
        op.add_column(table, sa.Column('user_id_new', sa.Uuid(), nullable=True))
    op.add_column('org_invites', sa.Column('invited_by_new', sa.Uuid(), nullable=True))

    # 4. Mevcut integer ID'leri eşleştirip UUID'leri doldur
    for table, col in [
        ('watchlist', 'user_id_new'),
        ('notifications', 'user_id_new'),
        ('saved_features', 'user_id_new'),
        ('user_repos', 'user_id_new'),
        ('organization_members', 'user_id_new'),
    ]:
        op.execute(f'UPDATE {table} t SET {col} = u.id_new FROM users u WHERE u.id = t.user_id')
    op.execute('UPDATE org_invites t SET invited_by_new = u.id_new FROM users u WHERE u.id = t.invited_by')

    # 5. Eski integer kolonları drop et, yenileri rename et
    op.drop_column('users', 'id')
    op.alter_column('users', 'id_new', new_column_name='id')
    op.execute('ALTER TABLE users ADD PRIMARY KEY (id)')

    for table, old_col, new_col in [
        ('watchlist', 'user_id', 'user_id_new'),
        ('notifications', 'user_id', 'user_id_new'),
        ('saved_features', 'user_id', 'user_id_new'),
        ('user_repos', 'user_id', 'user_id_new'),
        ('organization_members', 'user_id', 'user_id_new'),
    ]:
        op.drop_column(table, old_col)
        op.alter_column(table, new_col, new_column_name=old_col)
        op.execute(f'ALTER TABLE {table} ALTER COLUMN {old_col} SET NOT NULL')

    op.drop_column('org_invites', 'invited_by')
    op.alter_column('org_invites', 'invited_by_new', new_column_name='invited_by')
    op.execute('ALTER TABLE org_invites ALTER COLUMN invited_by SET NOT NULL')

    # 6. FK'ları yeniden ekle
    op.create_foreign_key('watchlist_user_id_fkey', 'watchlist', 'users', ['user_id'], ['id'])
    op.create_foreign_key('notifications_user_id_fkey', 'notifications', 'users', ['user_id'], ['id'])
    op.create_foreign_key('saved_features_user_id_fkey', 'saved_features', 'users', ['user_id'], ['id'])
    op.create_foreign_key('user_repos_user_id_fkey', 'user_repos', 'users', ['user_id'], ['id'])
    op.create_foreign_key('organization_members_user_id_fkey', 'organization_members', 'users', ['user_id'], ['id'])
    op.create_foreign_key('org_invites_invited_by_fkey', 'org_invites', 'users', ['invited_by'], ['id'])

    # 7. Index'leri yenile
    op.create_index('ix_watchlist_user_id', 'watchlist', ['user_id'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_saved_features_user_id', 'saved_features', ['user_id'])
    op.create_index('ix_user_repos_user_id', 'user_repos', ['user_id'])
    op.create_index('ix_organization_members_user_id', 'organization_members', ['user_id'])


def downgrade() -> None:
    raise NotImplementedError("UUID → int geri dönüşü desteklenmiyor")
