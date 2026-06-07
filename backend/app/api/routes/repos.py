from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.repo import Repo, RepoSnapshot
from app.services.github import GithubService
from app.services.health_score import HealthScoreEngine
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/")
async def get_repos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Repo))
    repos = result.scalars().all()
    return {"repos": [{"id": r.id, "full_name": r.full_name, "stars": r.stars} for r in repos]}

@router.post("/analyze")
async def analyze_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    github = GithubService()
    engine = HealthScoreEngine()

    try:
        repo_data = await github.get_repo(owner, name)
        commits = await github.get_commits(owner, name)
        issues = await github.get_issues(owner, name)
        pull_requests = await github.get_pull_requests(owner, name)
        contributors = await github.get_contributors(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    score_data = engine.calculate(repo_data, commits, issues, pull_requests, contributors)

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
        "id": repo.id,
        "repo": f"{owner}/{name}",
        "health_score": score_data["health_score"],
        "breakdown": score_data["breakdown"],
        "metrics": score_data["metrics"],
    }

@router.get("/chart/{owner}/{name}/commits")
async def get_commit_chart(owner: str, name: str):
    github = GithubService()

    try:
        commits = await github.get_commits(owner, name, days=90)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    weeks = {}
    for commit in commits:
        date_str = commit["commit"]["author"]["date"]
        date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        week_start = date - timedelta(days=date.weekday())
        week_key = week_start.strftime("%d %b")
        weeks[week_key] = weeks.get(week_key, 0) + 1

    chart_data = [
        {"week": week, "commits": count}
        for week, count in sorted(weeks.items())
    ]

    return {"chart_data": chart_data}

@router.get("/{owner}/{name}")
async def get_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")
    return repo