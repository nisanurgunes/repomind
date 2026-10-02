"""Ortak test ayarları ve fixture'lar.

DB testleri gerçek bir Postgres'e karşı çalışır ve her testten önce tabloları
boşaltır. Bu yüzden yalnızca TEST_DATABASE_URL ile verilen, yerelde çalışan bir
veritabanına bağlanır — backend/.env içindeki DATABASE_URL asla kullanılmaz.
"""
import datetime
import os
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
LOCAL_DB_HOSTS = {"localhost", "127.0.0.1", "::1", "postgres"}

if TEST_DATABASE_URL:
    _host = urlsplit(TEST_DATABASE_URL).hostname
    if _host not in LOCAL_DB_HOSTS and os.getenv("ALLOW_REMOTE_TEST_DB") != "1":
        pytest.exit(
            f"TEST_DATABASE_URL yerel bir veritabanı değil ({_host}). Testler tabloları "
            "boşalttığı için uzak bir veritabanında çalıştırılmaz.",
            returncode=1,
        )
elif os.getenv("CI"):
    pytest.exit("CI'da TEST_DATABASE_URL tanımlı olmalı — DB testleri sessizce atlanamaz.", returncode=1)

# app import edilmeden ÖNCE ayarlanmalı: Settings() import anında okunur ve ortam
# değişkenleri .env dosyasının önüne geçer. Böylece testler .env'deki gerçek
# veritabanına ya da gerçek API anahtarlarına hiç dokunmaz.
os.environ.update({
    "DATABASE_URL": TEST_DATABASE_URL or "postgresql+asyncpg://unused:unused@localhost:1/unused",
    "REDIS_URL": "redis://localhost:1",
    "DEBUG": "false",
    "SECRET_KEY": "test-secret-key-not-used-anywhere-else",
    "GITHUB_CLIENT_ID": "test-client-id",
    "GITHUB_CLIENT_SECRET": "test-client-secret",
    "GITHUB_TOKEN": "",
    "ANTHROPIC_API_KEY": "",
    "STRIPE_SECRET_KEY": "",
    "STRIPE_WEBHOOK_SECRET": "",
    "FRONTEND_URL": "http://localhost:3000",
})
for _var in ("OAUTH_REDIRECT_URI", "BACKEND_URL", "FRONTEND_URL_PREVIEW"):
    os.environ.pop(_var, None)

import jwt  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture(scope="session")
def migrated_db():
    """Şemayı yalnızca Alembic migration'larıyla kurar (create_all yok) — böylece
    API testleri aynı zamanda migration'ların modellerle uyumunu da doğrular."""
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL tanımlı değil — veritabanı testleri atlandı")

    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")


@pytest_asyncio.fixture
async def db(migrated_db):
    from app.core.database import AsyncSessionLocal, Base, engine
    import app.models.repo  # noqa: F401 — modelleri Base'e kaydet
    import app.models.user  # noqa: F401

    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))

    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db):
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def make_user(db):
    async def _make_user(**overrides) -> User:
        suffix = uuid.uuid4().hex[:8]
        fields = {
            "email": f"user-{suffix}@example.com",
            "name": f"User {suffix}",
            "github_id": uuid.uuid4().int % 1_000_000_000,
        }
        fields.update(overrides)
        user = User(**fields)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    return _make_user


@pytest.fixture
def auth_headers():
    def _auth_headers(user: User) -> dict[str, str]:
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers
