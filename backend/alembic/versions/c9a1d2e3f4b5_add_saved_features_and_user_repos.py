"""add saved_features and user_repos tables

Bu iki tablo canlıda uygulama açılışındaki create_all ile oluşmuştu; hiçbir
migration onları oluşturmuyordu. Oysa sıradaki d4e7a1b2c3f0 (user id -> UUID)
ikisini de değiştiriyor, bu yüzden boş bir veritabanında `alembic upgrade head`
orada kırılıyordu. Bu migration zincire geriye dönük eklendi: mevcut veritabanı
zaten daha ileri bir revision'da olduğu için orada çalışmaz, yalnızca sıfırdan
kurulan veritabanlarında (staging, CI) devreye girer.

Kolonlar o tarihteki halleriyle (integer user_id) tanımlı — UUID'ye çevirme işi
d4e7a1b2c3f0'da.

Revision ID: c9a1d2e3f4b5
Revises: c3f1a2b4d5e6
Create Date: 2026-10-02

"""
from alembic import op
import sqlalchemy as sa

revision = 'c9a1d2e3f4b5'
down_revision = 'c3f1a2b4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_repos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('github_repo_id', sa.Integer(), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('language', sa.String(100), nullable=True),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_repos_user_id', 'user_repos', ['user_id'])
    op.create_index('ix_user_repos_github_repo_id', 'user_repos', ['github_repo_id'])
    op.create_index('ix_user_repos_full_name', 'user_repos', ['full_name'])

    op.create_table(
        'saved_features',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('repo_full_name', sa.String(511), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), nullable=False),
        sa.Column('effort', sa.String(20), nullable=False),
        sa.Column('status', sa.Enum('pending', 'in_progress', 'done', name='featurestatus'), nullable=False),
        sa.Column('seen_in', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_saved_features_user_id', 'saved_features', ['user_id'])
    op.create_index('ix_saved_features_repo_full_name', 'saved_features', ['repo_full_name'])


def downgrade() -> None:
    op.drop_table('saved_features')
    op.execute("DROP TYPE IF EXISTS featurestatus")
    op.drop_table('user_repos')
