from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "devpulse",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.timezone = "Europe/Istanbul"

# Günlük gece yarısı watchlist'teki tüm repoları yeniden analiz et
celery_app.conf.beat_schedule = {
    "daily-watchlist-refresh": {
        "task": "app.workers.tasks.refresh_watchlist_repos",
        "schedule": crontab(hour=3, minute=0),  # Her gece 03:00'da
    },
}


@celery_app.task(name="app.workers.tasks.refresh_watchlist_repos")
def refresh_watchlist_repos():
    """Watchlist'teki tüm benzersiz repoları yeniden analiz eder."""
    import asyncio
    asyncio.run(_refresh_all())


async def _refresh_all():
    from sqlalchemy import select, distinct
    from app.core.database import AsyncSessionLocal
    from app.models.repo import Repo, RepoSnapshot, Watchlist
    from app.services.github import GithubService
    from app.services.health_score import HealthScoreEngine
    from app.services.readme_parser import parse_readme
    from datetime import datetime, timezone

    async with AsyncSessionLocal() as db:
        # Watchlist'te olan tüm benzersiz repoları al
        result = await db.execute(
            select(Repo)
            .join(Watchlist, Watchlist.repo_id == Repo.id)
            .distinct()
        )
        repos = result.scalars().all()

        github = GithubService()
        engine = HealthScoreEngine()

        for repo in repos:
            try:
                repo_data = await github.get_repo(repo.owner, repo.name)
                commits = await github.get_commits(repo.owner, repo.name)
                issues = await github.get_issues(repo.owner, repo.name)
                pull_requests = await github.get_pull_requests(repo.owner, repo.name)
                contributors = await github.get_contributors(repo.owner, repo.name)
                community_files = await github.get_community_files(repo.owner, repo.name)
                readme_content = await github.get_readme_content(repo.owner, repo.name)

                repo_topics = repo_data.get("topics", [])
                parse_readme(readme_content, repo_topics)  # ileride kaydedilebilir

                score_data = engine.calculate(
                    repo_data, commits, issues, pull_requests, contributors, community_files
                )

                # Repo metriklerini güncelle
                repo.stars = repo_data.get("stargazers_count", repo.stars)
                repo.forks = repo_data.get("forks_count", repo.forks)
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

                print(f"✓ {repo.full_name} → {score_data['health_score']}")

            except Exception as e:
                print(f"✗ {repo.full_name} hata: {e}")
                continue
