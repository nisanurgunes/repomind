import datetime

import pytest
from sqlalchemy import func, select

from app.api.routes import repos as repos_module
from app.models.repo import Repo, RepoSnapshot


async def make_repo(db, full_name: str = "octocat/hello", **fields) -> Repo:
    owner, name = full_name.split("/")
    repo = Repo(github_id=fields.pop("github_id", 1), owner=owner, name=name, full_name=full_name, **fields)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


async def add_snapshot(db, repo: Repo, health_score: float, days_ago: int = 0) -> None:
    date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_ago)
    db.add(RepoSnapshot(repo_id=repo.id, health_score=health_score, date=date))
    await db.commit()


class FakeGithubService:
    """GitHub API'sine gitmeden /analyze akışını çalıştırmak için."""

    async def get_repo(self, owner, name):
        return {
            "id": 777,
            "full_name": f"{owner}/{name}",
            "description": "A demo repo",
            "stargazers_count": 12,
            "forks_count": 4,
            "open_issues_count": 1,
            "language": "Python",
            "topics": ["fastapi"],
        }

    async def get_commits(self, owner, name, days=90):
        return [{}] * 100

    async def get_issues(self, owner, name):
        return [{"state": "closed", "created_at": "2026-01-01T00:00:00Z", "closed_at": "2026-01-01T02:00:00Z"}]

    async def get_pull_requests(self, owner, name):
        return [{"created_at": "2026-01-01T00:00:00Z", "merged_at": "2026-01-01T03:00:00Z"}]

    async def get_contributors(self, owner, name):
        return [{}] * 20

    async def get_community_files(self, owner, name):
        return {"readme": True, "license": True, "contributing": True, "issue_template": True}

    async def get_readme_content(self, owner, name):
        return "# Demo\n\nA demo project built with FastAPI and PostgreSQL for tests."


@pytest.fixture
def fake_github(monkeypatch):
    monkeypatch.setattr(repos_module, "GithubService", FakeGithubService)


async def test_scorecard_for_unknown_repo_is_404(client):
    res = await client.get("/api/repos/octocat/missing/scorecard")

    assert res.status_code == 404


async def test_scorecard_requires_an_analysis(client, db):
    await make_repo(db)

    res = await client.get("/api/repos/octocat/hello/scorecard")

    assert res.status_code == 404


async def test_scorecard_returns_latest_snapshot(client, db):
    repo = await make_repo(db, stars=10, language="Python")
    await add_snapshot(db, repo, health_score=40.0, days_ago=3)
    await add_snapshot(db, repo, health_score=75.5, days_ago=0)

    res = await client.get("/api/repos/octocat/hello/scorecard")

    assert res.status_code == 200
    body = res.json()
    assert body["health_score"] == 75.5
    assert body["stars"] == 10
    assert body["language"] == "Python"


async def test_history_is_returned_oldest_first(client, db):
    repo = await make_repo(db)
    await add_snapshot(db, repo, health_score=40.0, days_ago=2)
    await add_snapshot(db, repo, health_score=60.0, days_ago=1)
    await add_snapshot(db, repo, health_score=80.0, days_ago=0)

    res = await client.get("/api/repos/octocat/hello/history")

    assert [h["health_score"] for h in res.json()["history"]] == [40.0, 60.0, 80.0]


async def test_repo_detail_without_snapshot(client, db):
    await make_repo(db)

    res = await client.get("/api/repos/octocat/hello")

    assert res.status_code == 200
    assert res.json()["latest_snapshot"] is None
    assert (await client.get("/api/repos/octocat/missing")).status_code == 404


@pytest.mark.parametrize(
    "health_score, color",
    [(92.0, "#16a34a"), (65.0, "#ca8a04"), (30.0, "#dc2626")],
)
async def test_badge_color_follows_score(client, db, health_score, color):
    repo = await make_repo(db)
    await add_snapshot(db, repo, health_score=health_score)

    res = await client.get("/api/repos/octocat/hello/badge")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("image/svg+xml")
    assert f'fill="{color}"' in res.text
    assert f">{health_score}<" in res.text


async def test_badge_for_unknown_repo_shows_placeholder(client):
    res = await client.get("/api/repos/octocat/missing/badge")

    assert res.status_code == 200
    assert ">?<" in res.text


async def test_analyze_stores_repo_and_snapshot(client, db, fake_github):
    res = await client.post("/api/repos/analyze", params={"owner": "octocat", "name": "demo"})

    assert res.status_code == 200
    body = res.json()
    assert body["repo"] == "octocat/demo"
    assert body["health_score"] == 100.0
    assert body["readme"]["tech_stack"] == ["FastAPI", "PostgreSQL"]

    repo = (await db.execute(select(Repo))).scalar_one()
    assert (repo.full_name, repo.stars, repo.language) == ("octocat/demo", 12, "Python")
    snapshot = (await db.execute(select(RepoSnapshot))).scalar_one()
    assert snapshot.health_score == 100.0


async def test_reanalyzing_adds_a_snapshot_without_duplicating_the_repo(client, db, fake_github):
    await client.post("/api/repos/analyze", params={"owner": "octocat", "name": "demo"})
    await client.post("/api/repos/analyze", params={"owner": "octocat", "name": "demo"})

    assert (await db.execute(select(func.count(Repo.id)))).scalar_one() == 1
    assert (await db.execute(select(func.count(RepoSnapshot.id)))).scalar_one() == 2
