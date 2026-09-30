from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRepo
import httpx
import jwt
import datetime
import logging
import os
from urllib.parse import urlencode

router = APIRouter()

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_SCOPE = "read:user,user:email,repo"


def _clean(value: str | None) -> str:
    # Dashboard'a yapıştırılan değerlerde kalan boşluk/satır sonu/tırnak
    # GitHub'da "incorrect_client_credentials" hatasına yol açıyor.
    return (value or "").strip().strip("\"'")


def _oauth_redirect_uri() -> str:
    """GitHub'ın girişten sonra kullanıcıyı döndüreceği adres.

    OAUTH_REDIRECT_URI frontend'deki /auth/callback'e ayarlanınca kullanıcı
    hiç backend domain'ine gitmeden giriş yapar (Render domain'i tarayıcılarda
    güvensiz olarak işaretli). Ayarlanmazsa eski akış (backend callback) sürer —
    GitHub OAuth App'teki callback URL ile birlikte değiştirilmeli.
    """
    explicit = _clean(os.getenv("OAUTH_REDIRECT_URI"))
    if explicit:
        return explicit
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    return f"{backend_url}/api/auth/callback"


@router.get("/github/config")
async def github_config():
    """Frontend'in GitHub authorize URL'ini kendisinin kurması için (client_id public)."""
    return {
        "client_id": _clean(settings.GITHUB_CLIENT_ID),
        "redirect_uri": _oauth_redirect_uri(),
        "scope": GITHUB_SCOPE,
    }


@router.get("/login")
async def github_login():
    """Eski akış — yeni frontend kullanmıyor, önbellekteki eski sayfalar için duruyor."""
    params = urlencode({
        "client_id": _clean(settings.GITHUB_CLIENT_ID),
        "scope": GITHUB_SCOPE,
        "redirect_uri": _oauth_redirect_uri(),
    })
    return RedirectResponse(url=f"{GITHUB_AUTH_URL}?{params}")


async def _complete_github_login(code: str, db: AsyncSession) -> str:
    """GitHub code'unu access token'a çevirir, kullanıcıyı oluşturur/günceller, JWT döner."""
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": _clean(settings.GITHUB_CLIENT_ID),
                "client_secret": _clean(settings.GITHUB_CLIENT_SECRET),
                "code": code,
                "redirect_uri": _oauth_redirect_uri(),
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            logging.error(f"GitHub token error: {token_data}")
            error_code = token_data.get("error", "unknown_error")
            raise HTTPException(status_code=400, detail=f"GitHub girişi başarısız ({error_code}). Lütfen tekrar dene.")

        user_response = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        github_user = user_response.json()

    result = await db.execute(
        select(User).where(User.github_id == github_user["id"])
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            github_id=github_user["id"],
            email=github_user.get("email") or f"{github_user['login']}@github.com",
            name=github_user.get("name") or github_user["login"],
            avatar_url=github_user.get("avatar_url"),
            github_token=access_token,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.github_token = access_token
        await db.commit()

    # Kullanıcının GitHub repolarını çek (son senkron 1 saatten eskiyse)
    try:
        from sqlalchemy import delete
        last_repo = await db.execute(
            select(UserRepo)
            .where(UserRepo.user_id == user.id)
            .order_by(UserRepo.synced_at.desc())
            .limit(1)
        )
        last = last_repo.scalar_one_or_none()

        should_sync = True
        if last and last.synced_at:
            age = datetime.datetime.utcnow() - last.synced_at.replace(tzinfo=None)
            if age.total_seconds() < 3600:
                should_sync = False

        if should_sync:
            async with httpx.AsyncClient(timeout=10.0) as repo_client:
                repos_response = await repo_client.get(
                    "https://api.github.com/user/repos",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github+json",
                    },
                    params={"per_page": 100, "sort": "updated", "affiliation": "owner"},
                )
                if repos_response.status_code == 200:
                    github_repos = repos_response.json()
                    await db.execute(delete(UserRepo).where(UserRepo.user_id == user.id))
                    for r in github_repos[:50]:
                        db.add(UserRepo(
                            user_id=user.id,
                            github_repo_id=r["id"],
                            full_name=r["full_name"],
                            name=r["name"],
                            description=r.get("description"),
                            language=r.get("language"),
                            stars=r.get("stargazers_count", 0),
                            is_private=r.get("private", False),
                        ))
                    await db.commit()
    except Exception:
        pass  # Repo sync hatası login'i engellemesin

    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.get("/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Eski akış: GitHub backend'e döner, backend token'la frontend'e yönlendirir."""
    jwt_token = await _complete_github_login(code, db)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(url=f"{frontend_url}/auth/callback?token={jwt_token}")


class GithubCodeExchange(BaseModel):
    code: str


@router.post("/github/exchange")
async def github_exchange(body: GithubCodeExchange, db: AsyncSession = Depends(get_db)):
    """Yeni akış: GitHub frontend'e döner, frontend code'u buraya fetch ile gönderir."""
    return {"token": await _complete_github_login(body.code, db)}
