import uuid

import jwt

from app.core.config import settings


async def test_admin_endpoints_reject_regular_users(client, make_user, auth_headers):
    user = await make_user()
    headers = auth_headers(user)

    assert (await client.get("/api/admin/users", headers=headers)).status_code == 403
    assert (await client.post(f"/api/admin/impersonate/{user.id}", headers=headers)).status_code == 403


async def test_admin_endpoints_require_authentication(client):
    assert (await client.get("/api/admin/users")).status_code in (401, 403)


async def test_admin_can_list_users(client, make_user, auth_headers):
    admin = await make_user(is_admin=True, email="admin@example.com")
    await make_user(email="someone@example.com")

    res = await client.get("/api/admin/users", headers=auth_headers(admin))

    assert res.status_code == 200
    assert {u["email"] for u in res.json()["users"]} == {"admin@example.com", "someone@example.com"}


async def test_admin_never_receives_github_tokens(client, make_user, auth_headers):
    admin = await make_user(is_admin=True)
    await make_user(github_token="gho_should_not_leak")

    res = await client.get("/api/admin/users", headers=auth_headers(admin))

    assert "gho_should_not_leak" not in res.text


async def test_impersonation_token_logs_in_as_target_user(client, make_user, auth_headers):
    admin = await make_user(is_admin=True)
    target = await make_user(email="target@example.com")

    res = await client.post(f"/api/admin/impersonate/{target.id}", headers=auth_headers(admin))

    assert res.status_code == 200
    token = res.json()["token"]
    assert jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])["sub"] == str(target.id)
    me = await client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == "target@example.com"
    assert me.json()["is_admin"] is False


async def test_impersonate_validates_target(client, make_user, auth_headers):
    headers = auth_headers(await make_user(is_admin=True))

    assert (await client.post("/api/admin/impersonate/not-a-uuid", headers=headers)).status_code == 400
    assert (await client.post(f"/api/admin/impersonate/{uuid.uuid4()}", headers=headers)).status_code == 404
