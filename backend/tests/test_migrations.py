"""Migration'lar ile SQLAlchemy modelleri arasındaki uyumu doğrular.

Şema bu testlerde yalnızca `alembic upgrade head` ile kurulur. Bir modele alan
ekleyip migration'ını yazmayı unutursan burası kırılır.
"""
from sqlalchemy import inspect, text

import app.models.repo  # noqa: F401 — modelleri Base'e kaydet
import app.models.user  # noqa: F401
from app.core.database import Base


async def _inspect(db, fn):
    connection = await db.connection()
    return await connection.run_sync(lambda sync_conn: fn(inspect(sync_conn)))


async def test_migrations_reach_a_single_head(db):
    rows = (await db.execute(text("SELECT version_num FROM alembic_version"))).scalars().all()

    assert len(rows) == 1


async def test_every_model_table_is_created_by_migrations(db):
    db_tables = set(await _inspect(db, lambda insp: insp.get_table_names()))

    missing = set(Base.metadata.tables) - db_tables
    assert not missing, f"Migration'ı olmayan tablolar: {sorted(missing)}"


async def test_every_model_column_is_created_by_migrations(db):
    def collect(insp):
        return {
            table: {column["name"] for column in insp.get_columns(table)}
            for table in insp.get_table_names()
        }

    db_columns = await _inspect(db, collect)

    missing = [
        f"{table.name}.{column.name}"
        for table in Base.metadata.sorted_tables
        for column in table.columns
        if column.name not in db_columns.get(table.name, set())
    ]
    assert not missing, f"Migration'ı olmayan kolonlar: {missing}"
