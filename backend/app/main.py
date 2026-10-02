from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.billing import QuotaExceededError
from app.api.routes import repos, users, auth, notifications, orgs, features, billing, admin


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="0.1.0",
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

@app.exception_handler(QuotaExceededError)
async def quota_exceeded_handler(request: Request, exc: QuotaExceededError):
    return JSONResponse(
        status_code=402,
        content={
            "error": "quota_exceeded",
            "feature": exc.feature_kind,
            "limit": exc.limit,
            "owner_type": exc.owner_type,
            "upgrade_url": "/pricing",
        },
    )

# Routes
app.include_router(repos.router, prefix="/api/repos", tags=["repos"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(orgs.router, prefix="/api/orgs", tags=["orgs"])
app.include_router(features.router, prefix="/api/features", tags=["features"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "DevPulse API çalışıyor 🚀"}

@app.get("/health")
async def health():
    return {"status": "ok"}