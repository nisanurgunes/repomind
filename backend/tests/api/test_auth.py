from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from sqlalchemy import func, select

from app.api.routes import auth as auth_module
from app.models.user import User, UserRepo

GITHUB_USER = {
    "id": 4242,
    "login": "octocat",
    "name": "Octo Cat",
    "email": "octo@example.com",
    "avatar_url": "https://avatars.example.com/octocat.png",
}

GITHUB_REPOS = [
    {"id": 1, "full_name": "octocat/public-repo", "name": "public-repo", "stargazers_count": 5, "private": False},
    {"id": 2, "full_name": "octocat/private-repo", "name": "private-repo", "stargazers_count": 9, "private": True},
]


@pytest.fixture
def github(monkeypatch):
    """auth modülünün GitHub'a yaptığı HTTP çağrılarını sahte yanıtlarla karşılar."""
    state = SimpleNamespace(
        token_response={"access_token": "gho_test_token"},
        user=dict(GITHUB_USER),
        repos=list(GITHUB_REPOS),
        requests=[],
    )

    def handler(request: httpx.Request) -> httpx.Response:
        state.requests.append(request)
        if request.url.host == "github.com" and request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json=state.token_response)
        if request.url.host == "api.github.com" and request.url.path == "/user":
            return httpx.Response(200, json=state.user)
        if request.url.host == "api.github.com" and request.url.path == "/user/repos":
            return httpx.Response(200, json=state.repos)
        return httpx.Response(404)

    def fake_async_client(**kwargs):
        return httpx.AsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(auth_module, "httpx", SimpleNamespace(AsyncClient=fake_async_client))
    return state


async def test_github_config_returns_public_oauth_settings(client):
    res = await client.get("/api/auth/github/config")

    assert res.status_code == 200
    assert res.json() == {
        "client_id": "test-client-id",
        "redirect_uri": "http://localhost:8000/api/auth/callback",
        "scope": "read:user,user:email,repo",
    }


async def test_github_config_uses_explicit_redirect_uri(client, monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_URI", "https://app.example.com/auth/callback")

    res = await client.get("/api/auth/github/config")

    assert res.json()["redirect_uri"] == "https://app.example.com/auth/callback"


async def test_config_never_exposes_the_client_secret(client):
    res = await client.get("/api/auth/github/config")

    assert "test-client-secret" not in res.text


async def test_legacy_login_redirects_to_github(client):
    res = await client.get("/api/auth/login")

    assert res.status_code == 307
    location = urlsplit(res.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == "https://github.com/login/oauth/authorize"
    assert parse_qs(location.query)["client_id"] == ["test-client-id"]


async def test_exchange_creates_user_and_returns_working_token(client, github):
    res = await client.post("/api/auth/github/exchange", json={"code": "abc"})

    assert res.status_code == 200
    headers = {"Authorization": f"Bearer {res.json()['token']}"}
    me = await client.get("/api/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["email"] == "octo@example.com"
    assert me.json()["name"] == "Octo Cat"


async def test_exchange_sends_code_secret_and_redirect_uri_to_github(client, github):
    await client.post("/api/auth/github/exchange", json={"code": "abc"})

    form = parse_qs(github.requests[0].content.decode())
    assert form == {
        "client_id": ["test-client-id"],
        "client_secret": ["test-client-secret"],
        "code": ["abc"],
        "redirect_uri": ["http://localhost:8000/api/auth/callback"],
    }


async def test_exchange_syncs_users_github_repos(client, github):
    res = await client.post("/api/auth/github/exchange", json={"code": "abc"})
    headers = {"Authorization": f"Bearer {res.json()['token']}"}

    repos = (await client.get("/api/users/my-repos", headers=headers)).json()["repos"]

    # Yıldız sayısına göre azalan sırada
    assert [(r["full_name"], r["is_private"]) for r in repos] == [
        ("octocat/private-repo", True),
        ("octocat/public-repo", False),
    ]


async def test_exchange_falls_back_to_login_based_email(client, github, db):
    github.user = {**GITHUB_USER, "email": None, "name": None}

    await client.post("/api/auth/github/exchange", json={"code": "abc"})

    user = (await db.execute(select(User))).scalar_one()
    assert user.email == "octocat@github.com"
    assert user.name == "octocat"


async def test_second_login_reuses_the_same_user(client, github, db):
    await client.post("/api/auth/github/exchange", json={"code": "first"})
    github.token_response = {"access_token": "gho_second_token"}
    await client.post("/api/auth/github/exchange", json={"code": "second"})

    assert (await db.execute(select(func.count(User.id)))).scalar_one() == 1
    user = (await db.execute(select(User))).scalar_one()
    assert user.github_token == "gho_second_token"
    # Repolar 1 saat içinde tekrar senkronlanmaz, kayıtlar çoğalmaz
    assert (await db.execute(select(func.count(UserRepo.id)))).scalar_one() == 2


async def test_exchange_reports_github_error_code(client, github, db):
    github.token_response = {"error": "bad_verification_code", "error_description": "expired"}

    res = await client.post("/api/auth/github/exchange", json={"code": "used"})

    assert res.status_code == 400
    assert "bad_verification_code" in res.json()["detail"]
    assert (await db.execute(select(func.count(User.id)))).scalar_one() == 0


async def test_exchange_requires_a_code(client):
    res = await client.post("/api/auth/github/exchange", json={})

    assert res.status_code == 422


async def test_legacy_callback_redirects_to_frontend_with_token(client, github):
    res = await client.get("/api/auth/callback", params={"code": "abc"})

    assert res.status_code == 307
    assert res.headers["location"].startswith("http://localhost:3000/auth/callback?token=")
