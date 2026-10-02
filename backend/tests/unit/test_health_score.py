import pytest

from app.services.health_score import HealthScoreEngine


def closed_issue(created: str, closed: str) -> dict:
    return {"state": "closed", "created_at": created, "closed_at": closed}


def merged_pr(created: str, merged: str) -> dict:
    return {"created_at": created, "merged_at": merged}


@pytest.fixture
def engine() -> HealthScoreEngine:
    return HealthScoreEngine()


def test_empty_repo_gets_neutral_issue_and_pr_scores(engine):
    result = engine.calculate(repo={}, commits=[], issues=[], pull_requests=[], contributors=[])

    assert result["breakdown"] == {
        "commit_score": 0,
        "issue_score": 50,
        "pr_score": 50,
        "contributor_score": 0,
        "docs_score": 0,
    }
    # 50 * 0.20 (issue) + 50 * 0.20 (pr)
    assert result["health_score"] == 20.0


def test_total_is_weighted_sum_of_breakdown(engine):
    result = engine.calculate(
        repo={"stargazers_count": 7, "forks_count": 3, "open_issues_count": 2},
        commits=[{}] * 100,
        issues=[closed_issue("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")],
        pull_requests=[merged_pr("2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z")],
        contributors=[{}] * 5,
        community_files={"readme": True, "license": True},
    )

    assert result["breakdown"] == {
        "commit_score": 100,
        "issue_score": 100,
        "pr_score": 80,
        "contributor_score": 60,
        "docs_score": 65.0,
    }
    # 100*0.25 + 100*0.20 + 80*0.20 + 60*0.20 + 65*0.15
    assert result["health_score"] == 82.8
    assert result["metrics"]["stars"] == 7
    assert result["metrics"]["forks"] == 3
    assert result["metrics"]["open_issues"] == 2
    assert result["metrics"]["avg_issue_response_hours"] == 12.0
    assert result["metrics"]["avg_pr_merge_hours"] == 48.0


@pytest.mark.parametrize(
    "commit_count, expected",
    [(0, 0), (1, 20), (9, 20), (10, 40), (20, 60), (50, 80), (99, 80), (100, 100)],
)
def test_commit_score_thresholds(engine, commit_count, expected):
    assert engine._commit_score([{}] * commit_count) == expected


@pytest.mark.parametrize(
    "contributor_count, expected",
    [(0, 0), (1, 20), (2, 40), (5, 60), (10, 80), (20, 100)],
)
def test_contributor_score_thresholds(engine, contributor_count, expected):
    assert engine._contributor_score([{}] * contributor_count) == expected


def test_issue_score_ignores_pull_requests_in_issue_list(engine):
    # GitHub issues API'si PR'ları da döndürür; skor yalnızca gerçek issue'lardan hesaplanmalı
    issues = [
        {**closed_issue("2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"), "pull_request": {}},
        closed_issue("2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"),
    ]

    assert engine._avg_issue_hours(issues) == 6.0
    assert engine._issue_score(issues) == 100


def test_issue_score_is_low_when_nothing_is_closed(engine):
    assert engine._issue_score([{"state": "open", "created_at": "2026-01-01T00:00:00Z"}]) == 30


def test_pr_score_is_low_when_nothing_is_merged(engine):
    assert engine._pr_score([{"created_at": "2026-01-01T00:00:00Z", "merged_at": None}]) == 30


def test_docs_score_sums_community_files(engine):
    assert engine._docs_score({}) == 0
    assert engine._docs_score({"readme": True}) == 40
    assert engine._docs_score(
        {"readme": True, "license": True, "contributing": True, "issue_template": True}
    ) == 100


def test_missing_readme_produces_high_severity_recommendation(engine):
    result = engine.calculate(repo={}, commits=[], issues=[], pull_requests=[], contributors=[])

    docs_recs = [r for r in result["recommendations"] if r["area"] == "Dokümantasyon"]
    assert docs_recs and docs_recs[0]["severity"] == "high"


def test_healthy_repo_has_no_activity_recommendations(engine):
    result = engine.calculate(
        repo={},
        commits=[{}] * 100,
        issues=[closed_issue("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")],
        pull_requests=[merged_pr("2026-01-01T00:00:00Z", "2026-01-01T01:00:00Z")],
        contributors=[{}] * 20,
        community_files={"readme": True, "license": True, "contributing": True, "issue_template": True},
    )

    areas = {r["area"] for r in result["recommendations"]}
    assert not areas & {"Commit Aktivitesi", "Issue Yanıt Süresi", "PR Merge Hızı", "Contributor Sayısı"}
