from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRepo
from app.models.repo import Watchlist
import httpx
import jwt
import datetime

router = APIRouter()

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"

@router.get("/login")
async def github_login():
    import os
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    github_url = (
        f"{GITHUB_AUTH_URL}"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&scope=read:user,user:email,repo"
        f"&redirect_uri={backend_url}/api/auth/callback"
    )
    return RedirectResponse(url=github_url)

@router.get("/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    import os
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    # GitHub'dan access token al
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{backend_url}/api/auth/callback",
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            import logging
            logging.error(f"GitHub token error: {token_data}")
            raise HTTPException(status_code=400, detail=f"GitHub token alınamadı: {token_data}")

        # Kullanıcı bilgilerini al
        user_response = await client.get(
            GITHUB_USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
        )
        github_user = user_response.json()

    # Kullanıcıyı veritabanında bul veya oluştur
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

    # Kullanıcının GitHub repolarını çek — sadece ilk login'de veya 24 saatten eskiyse
    try:
        from sqlalchemy import delete, func as sqlfunc
        should_sync = True
        # Son sync zamanını kontrol et
        last_repo = await db.execute(
            select(UserRepo)
            .where(UserRepo.user_id == user.id)
            .order_by(UserRepo.synced_at.desc())
            .limit(1)
        )
        last = last_repo.scalar_one_or_none()
        if last and last.synced_at:
            age = datetime.datetime.utcnow() - last.synced_at.replace(tzinfo=None)
            if age.total_seconds() < 86400:  # 24 saat
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

    # JWT oluştur
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }
    jwt_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Frontend'e yönlendir
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return RedirectResponse(
        url=f"{frontend_url}/auth/callback?token={jwt_token}"
    )