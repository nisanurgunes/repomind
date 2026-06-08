from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.routes import repos, users, auth, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run migrations
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=False)
    yield

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — frontend Next.js ile konuşabilmek için
import os
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),          # Vercel URL'si (env var'dan)
    os.getenv("FRONTEND_URL_PREVIEW", ""),  # Vercel preview URL'leri
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_origin_regex=r"https://.*\.vercel\.app",  # tüm Vercel preview'ları
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(repos.router, prefix="/api/repos", tags=["repos"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

@app.get("/")
async def root():
    return {"message": "DevPulse API çalışıyor 🚀"}

@app.get("/health")
async def health():
    return {"status": "ok"}