import datetime
import uuid

import jwt

from app.core.config import settings
from app.models.repo import Repo


def token_for(sub: str, minutes: int = 5) -> dict[str, str]:
    payload = {
        "sub": sub,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=minutes),
    }
    return {"Authorization": f"Bearer {jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)}"}


async def make_repo(db, full_name: str = "octocat/hello", github_id: int = 1) -> Repo:
    owner, name = full_name.split("/")
    repo = Repo(github_id=github_id, owner=owner, name=name, full_name=full_name, stars=3)
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


async def test_health_endpoint(client):
    res = await client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_me_requires_authentication(client):
    res = await client.get("/api/users/me")

    assert res.status_code in (401, 403)


async def test_me_rejects_invalid_token(client):
    res = await client.get("/api/users/me", headers={"Authorization": "Bearer not-a-jwt"})

    assert res.status_code == 401


async def test_me_rejects_token_signed_with_another_secret(client, make_user):
    user = await make_user()
    forged = jwt.encode({"sub": str(user.id)}, "some-other-secret", algorithm="HS256")

    res = await client.get("/api/users/me", headers={"Authorization": f"Bearer {forged}"})

    assert res.status_code == 401


async def test_me_rejects_expired_token(client, make_user):
    user = await make_user()

    res = await client.get("/api/users/me", headers=token_for(str(user.id), minutes=-1))

    assert res.status_code == 401


async def test_me_rejects_token_of_unknown_user(client):
    res = await client.get("/api/users/me", headers=token_for(str(uuid.uuid4())))

    assert res.status_code == 401


async def test_me_returns_current_user(client, make_user, auth_headers):
    user = await make_user(name="Ada", email="ada@example.com")

    res = await client.get("/api/users/me", headers=auth_headers(user))

    assert res.status_code == 200
    assert res.json() == {
        "id": str(user.id),
        "name": "Ada",
        "email": "ada@example.com",
        "avatar_url": None,
        "plan": "free",
        "is_admin": False,
    }


async def test_watchlist_add_list_and_remove(client, db, make_user, auth_headers):
    headers = auth_headers(await make_user())
    repo = await make_repo(db)

    added = await client.post(f"/api/users/watchlist/{repo.id}", headers=headers)
    assert added.status_code == 200

    listed = (await client.get("/api/users/watchlist", headers=headers)).json()["watchlist"]
    assert [item["repo"]["full_name"] for item in listed] == ["octocat/hello"]

    await client.delete(f"/api/users/watchlist/{repo.id}", headers=headers)
    assert (await client.get("/api/users/watchlist", headers=headers)).json()["watchlist"] == []


async def test_watchlist_rejects_duplicates_and_unknown_repos(client, db, make_user, auth_headers):
    headers = auth_headers(await make_user())
    repo = await make_repo(db)
    await client.post(f"/api/users/watchlist/{repo.id}", headers=headers)

    assert (await client.post(f"/api/users/watchlist/{repo.id}", headers=headers)).status_code == 400
    assert (await client.post("/api/users/watchlist/999999", headers=headers)).status_code == 404


async def test_watchlist_is_private_to_each_user(client, db, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    other_headers = auth_headers(await make_user())
    repo = await make_repo(db)
    await client.post(f"/api/users/watchlist/{repo.id}", headers=owner_headers)

    assert (await client.get("/api/users/watchlist", headers=other_headers)).json()["watchlist"] == []


async def test_sync_repos_requires_a_github_token(client, make_user, auth_headers):
    user = await make_user(github_token=None)

    res = await client.post("/api/users/sync-repos", headers=auth_headers(user))

    assert res.status_code == 400
