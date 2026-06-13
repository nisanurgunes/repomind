from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.auth import get_current_user
import httpx
from app.models.user import User, UserRepo
from app.models.repo import Repo, Watchlist

router = APIRouter()

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "plan": current_user.plan,
    }

@router.get("/watchlist")
async def get_watchlist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Watchlist, Repo)
        .join(Repo, Watchlist.repo_id == Repo.id)
        .where(Watchlist.user_id == current_user.id)
    )
    rows = result.all()
    return {
        "watchlist": [
            {
                "id": watchlist.id,
                "repo": {
                    "id": repo.id,
                    "full_name": repo.full_name,
                    "description": repo.description,
                    "stars": repo.stars,
                    "language": repo.language,
                    "last_analyzed_at": str(repo.last_analyzed_at),
                }
            }
            for watchlist, repo in rows
        ]
    }

@router.post("/watchlist/{repo_id}")
async def add_to_watchlist(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Repo var mı?
    result = await db.execute(select(Repo).where(Repo.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")

    # Zaten eklenmiş mi?
    result = await db.execute(
        select(Watchlist).where(
            Watchlist.user_id == current_user.id,
            Watchlist.repo_id == repo_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Repo zaten watchlist'te")

    watchlist = Watchlist(user_id=current_user.id, repo_id=repo_id)
    db.add(watchlist)
    await db.commit()
    return {"status": "eklendi", "repo": repo.full_name}

@router.post("/sync-repos")
async def sync_my_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GitHub token'ı ile repoları zorla yeniler."""
    if not current_user.github_token:
        raise HTTPException(status_code=400, detail="GitHub token bulunamadı. Tekrar giriş yap.")

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.github.com/user/repos",
            headers={
                "Authorization": f"Bearer {current_user.github_token}",
                "Accept": "application/vnd.github+json",
            },
            params={"per_page": 100, "sort": "updated", "affiliation": "owner"},
        )

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub erişimi sona ermiş. Tekrar giriş yap.")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub'dan repolar alınamadı.")

    github_repos = response.json()
    await db.execute(delete(UserRepo).where(UserRepo.user_id == current_user.id))
    for r in github_repos[:50]:
        db.add(UserRepo(
            user_id=current_user.id,
            github_repo_id=r["id"],
            full_name=r["full_name"],
            name=r["name"],
            description=r.get("description"),
            language=r.get("language"),
            stars=r.get("stargazers_count", 0),
            is_private=r.get("private", False),
        ))
    await db.commit()
    return {"synced": len(github_repos[:50])}


@router.get("/my-repos")
async def get_my_repos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcının kendi GitHub repoları (login'de sync edilir)."""
    result = await db.execute(
        select(UserRepo)
        .where(UserRepo.user_id == current_user.id)
        .order_by(UserRepo.stars.desc())
    )
    repos = result.scalars().all()
    return {
        "repos": [
            {
                "id": r.id,
                "full_name": r.full_name,
                "name": r.name,
                "description": r.description,
                "language": r.language,
                "stars": r.stars,
                "is_private": r.is_private,
            }
            for r in repos
        ]
    }

@router.delete("/watchlist/{repo_id}")
async def remove_from_watchlist(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Watchlist).where(
            Watchlist.user_id == current_user.id,
            Watchlist.repo_id == repo_id,
        )
    )
    await db.commit()
    return {"status": "silindi"}