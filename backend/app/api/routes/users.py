from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.repo import Repo, RepoSnapshot
from app.services.github import GithubService
from app.services.health_score import HealthScoreEngine
from datetime import datetime, timezone

router = APIRouter()

@router.get("/")
async def get_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo))
    repos = result.scalars().all()
    return {"repos": [{"id": r.id, "full_name": r.full_name, "stars": r.stars} for r in repos]}

@router.get("/{owner}/{name}")
async def get_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")
    return repo

@router.post("/analyze")
async def analyze_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    github = GithubService()
    engine = HealthScoreEngine()

    try:
        # GitHub'dan verileri çek
        repo_data = await github.get_repo(owner, name)
        commits = await github.get_commits(owner, name)
        issues = await github.get_issues(owner, name)
        pull_requests = await github.get_pull_requests(owner, name)
        contributors = await github.get_contributors(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    # Skor hesapla
    score_data = engine.calculate(repo_data, commits, issues, pull_requests, contributors)

    # Repo'yu veritabanına kaydet veya güncelle
    result = await db.execute(
        select(Repo).where(Repo.github_id == repo_data["id"])
    )
    repo = result.scalar_one_or_none()

    if not repo:
        repo = Repo(
            github_id=repo_data["id"],
            owner=owner,
            name=name,
            full_name=repo_data["full_name"],
            description=repo_data.get("description"),
            stars=repo_data.get("stargazers_count", 0),
            forks=repo_data.get("forks_count", 0),
            language=repo_data.get("language"),
            is_archived=repo_data.get("archived", False),
        )
        db.add(repo)
        await db.flush()

    repo.last_analyzed_at = datetime.now(timezone.utc)

    # Snapshot kaydet
    snapshot = RepoSnapshot(
        repo_id=repo.id,
        commit_count_30d=score_data["metrics"]["commit_count_90d"],
        commit_count_90d=score_data["metrics"]["commit_count_90d"],
        open_issues=score_data["metrics"]["open_issues"],
        contributor_count=score_data["metrics"]["contributor_count"],
        health_score=score_data["health_score"],
    )
    db.add(snapshot)
    await db.commit()

    return {
        "repo": f"{owner}/{name}",
        "health_score": score_data["health_score"],
        "breakdown": score_data["breakdown"],
        "metrics": score_data["metrics"],
    }