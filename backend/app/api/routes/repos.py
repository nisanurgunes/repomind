from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models.repo import Repo, RepoSnapshot
from app.services.github import GithubService
from app.services.health_score import HealthScoreEngine
from app.services.readme_parser import parse_readme
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
        community_files = await github.get_community_files(owner, name)
        readme_content = await github.get_readme_content(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    repo_topics = repo_data.get("topics", [])
    readme_info = parse_readme(readme_content, repo_topics)

    score_data = engine.calculate(repo_data, commits, issues, pull_requests, contributors, community_files)

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
        avg_issue_response_hours=score_data["metrics"]["avg_issue_response_hours"],
        avg_pr_merge_hours=score_data["metrics"]["avg_pr_merge_hours"],
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
        "recommendations": score_data["recommendations"],
        "readme": readme_info,
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

@router.get("/{owner}/{name}/scorecard")
async def get_scorecard(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Public — login gerektirmez. Paylaşılabilir skor kartı verisi."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı. Önce analiz edilmeli.")

    snapshot_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(1)
    )
    snapshot = snapshot_result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Henüz analiz edilmemiş.")

    return {
        "full_name": repo.full_name,
        "description": repo.description,
        "language": repo.language,
        "stars": repo.stars,
        "forks": repo.forks,
        "health_score": snapshot.health_score,
        "commit_count_90d": snapshot.commit_count_90d,
        "open_issues": snapshot.open_issues,
        "contributor_count": snapshot.contributor_count,
        "avg_issue_response_hours": snapshot.avg_issue_response_hours,
        "avg_pr_merge_hours": snapshot.avg_pr_merge_hours,
        "analyzed_at": snapshot.date.isoformat() if snapshot.date else None,
    }

@router.get("/{owner}/{name}/badge")
async def get_badge(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Public — README'ye eklenebilir SVG badge."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()

    score = None
    if repo:
        snapshot_result = await db.execute(
            select(RepoSnapshot)
            .where(RepoSnapshot.repo_id == repo.id)
            .order_by(desc(RepoSnapshot.date))
            .limit(1)
        )
        snap = snapshot_result.scalar_one_or_none()
        if snap:
            score = snap.health_score

    if score is None:
        score = "?"
        color = "#6b7280"
        label_color = "#374151"
    elif score >= 80:
        color = "#16a34a"
        label_color = "#15803d"
    elif score >= 60:
        color = "#ca8a04"
        label_color = "#b45309"
    else:
        color = "#dc2626"
        label_color = "#b91c1c"

    score_text = str(score)
    score_width = len(score_text) * 7 + 16
    total_width = 82 + score_width

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="DevPulse: {score_text}">
  <title>DevPulse Score: {score_text}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total_width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="82" height="20" fill="#555"/>
    <rect x="82" width="{score_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="41" y="15" fill="#010101" fill-opacity=".3">DevPulse</text>
    <text x="41" y="14">DevPulse</text>
    <text x="{82 + score_width // 2}" y="15" fill="#010101" fill-opacity=".3">{score_text}</text>
    <text x="{82 + score_width // 2}" y="14">{score_text}</text>
  </g>
</svg>"""

    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "no-cache, max-age=0",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/{owner}/{name}/history")
async def get_repo_history(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    """Son 10 snapshot — skor geçmişi grafiği için."""
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")

    snapshots_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(10)
    )
    snapshots = snapshots_result.scalars().all()

    return {
        "history": [
            {
                "date": s.date.strftime("%d %b") if s.date else "",
                "health_score": s.health_score,
                "commit_count_90d": s.commit_count_90d,
                "open_issues": s.open_issues,
                "contributor_count": s.contributor_count,
            }
            for s in reversed(snapshots)
        ]
    }

@router.get("/{owner}/{name}/contributors-analysis")
async def get_contributors_analysis(owner: str, name: str):
    """Ekip analitik verisi — contributor, PR, commit zaman dağılımı, hot spot."""
    github = GithubService()
    try:
        commits = await github.get_commits_detailed(owner, name, days=90)
        contributors = await github.get_contributors(owner, name)
        pull_requests = await github.get_pull_requests_detailed(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub API hatası: {str(e)}")

    # --- Contributor bazlı commit sayısı ---
    contributor_commits: dict[str, int] = {}
    hourly_counts = [0] * 24
    daily_counts = [0] * 7  # 0=Mon ... 6=Sun
    file_changes: dict[str, int] = {}

    for commit in commits:
        author = (
            commit.get("author", {}) or {}
        )
        login = author.get("login") or (commit.get("commit", {}).get("author", {}).get("name") or "unknown")
        contributor_commits[login] = contributor_commits.get(login, 0) + 1

        # Commit zamanı
        date_str = commit.get("commit", {}).get("author", {}).get("date", "")
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                hourly_counts[dt.hour] += 1
                daily_counts[dt.weekday()] += 1
            except Exception:
                pass

    # Hot spot: top 20 commit için dosya listesini çek (rate limit'e takılmamak için)
    top_shas = [c["sha"] for c in commits[:20]]
    for sha in top_shas:
        files = await github.get_commit_files(owner, name, sha)
        for f in files:
            file_changes[f] = file_changes.get(f, 0) + 1

    hot_spots = sorted(file_changes.items(), key=lambda x: x[1], reverse=True)[:10]

    # --- PR metrikleri ---
    merged_prs = [pr for pr in pull_requests if pr.get("merged_at")]
    open_prs = [pr for pr in pull_requests if pr.get("state") == "open"]

    merge_hours_list = []
    for pr in merged_prs:
        try:
            created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
            merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
            merge_hours_list.append((merged - created).total_seconds() / 3600)
        except Exception:
            pass

    avg_merge_hours = round(sum(merge_hours_list) / len(merge_hours_list), 1) if merge_hours_list else None

    total_commits = len(commits)
    contributor_list = [
        {
            "login": login,
            "commits": count,
            "percent": round(count / total_commits * 100, 1) if total_commits else 0,
            "avatar_url": next(
                (c.get("avatar_url") for c in contributors if c.get("login") == login), None
            ),
        }
        for login, count in sorted(contributor_commits.items(), key=lambda x: x[1], reverse=True)
    ]

    days_labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    return {
        "contributors": contributor_list,
        "total_commits": total_commits,
        "pr_metrics": {
            "total": len(pull_requests),
            "merged": len(merged_prs),
            "open": len(open_prs),
            "avg_merge_hours": avg_merge_hours,
        },
        "commit_heatmap": {
            "hourly": [{"hour": f"{h:02d}:00", "commits": hourly_counts[h]} for h in range(24)],
            "daily": [{"day": days_labels[i], "commits": daily_counts[i]} for i in range(7)],
        },
        "hot_spots": [{"file": f, "changes": c} for f, c in hot_spots],
    }


@router.get("/{owner}/{name}")
async def get_repo(owner: str, name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Repo).where(Repo.full_name == f"{owner}/{name}")
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repo bulunamadı")

    snapshot_result = await db.execute(
        select(RepoSnapshot)
        .where(RepoSnapshot.repo_id == repo.id)
        .order_by(desc(RepoSnapshot.date))
        .limit(1)
    )
    snapshot = snapshot_result.scalar_one_or_none()

    return {
        "id": repo.id,
        "full_name": repo.full_name,
        "description": repo.description,
        "stars": repo.stars,
        "forks": repo.forks,
        "language": repo.language,
        "last_analyzed_at": repo.last_analyzed_at.isoformat() if repo.last_analyzed_at else None,
        "latest_snapshot": {
            "health_score": snapshot.health_score,
            "commit_count_90d": snapshot.commit_count_90d,
            "open_issues": snapshot.open_issues,
            "contributor_count": snapshot.contributor_count,
            "avg_issue_response_hours": snapshot.avg_issue_response_hours,
            "avg_pr_merge_hours": snapshot.avg_pr_merge_hours,
            "date": snapshot.date.isoformat() if snapshot.date else None,
        } if snapshot else None,
    }
