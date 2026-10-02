"""add rag pgvector infra: document_chunks table, analysis_jobs.job_type

Revision ID: f1a2b3c4d5e6
Revises: e5f8b3c6a1d2
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = 'f1a2b3c4d5e6'
down_revision = 'e5f8b3c6a1d2'
branch_labels = None
depends_on = None

EMBEDDING_DIM = 512


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.add_column(
        'analysis_jobs',
        sa.Column('job_type', sa.String(50), nullable=False, server_default='repo_analysis'),
    )

    op.create_table(
        'document_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('repo_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(1024), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('heading_path', sa.String(512), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(EMBEDDING_DIM), nullable=False),
        sa.Column('commit_sha', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['repo_id'], ['repos.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('repo_id', 'file_path', 'chunk_index', name='uq_document_chunks_repo_file_chunk'),
    )
    op.create_index('ix_document_chunks_repo_id', 'document_chunks', ['repo_id'])
    op.create_index('ix_document_chunks_repo_commit', 'document_chunks', ['repo_id', 'commit_sha'])
    op.create_index('ix_document_chunks_commit_sha', 'document_chunks', ['commit_sha'])
    # ANN index (ivfflat/hnsw) kasıtlı olarak eklenmedi — repo başına chunk sayısı
    # küçük (README + docs/*.md kapsamı), repo_id filtreli bir tarama ANN olmadan
    # yeterince hızlı. Korpus büyürse ayrı bir migration'da eklenebilir:
    #   op.execute("CREATE INDEX ix_document_chunks_embedding_hnsw ON document_chunks "
    #              "USING hnsw (embedding vector_cosine_ops)")


def downgrade() -> None:
    op.drop_index('ix_document_chunks_commit_sha', table_name='document_chunks')
    op.drop_index('ix_document_chunks_repo_commit', table_name='document_chunks')
    op.drop_index('ix_document_chunks_repo_id', table_name='document_chunks')
    op.drop_table('document_chunks')
    op.drop_column('analysis_jobs', 'job_type')
    # 'vector' extension kasıtlı olarak drop edilmiyor — paylaşımlı/global bir
    # Postgres objesi, kurulu bırakmak başka bir şeyi bozma riskinden daha güvenli.
