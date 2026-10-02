import pytest


async def create_org(client, headers, name: str = "Acme Team") -> dict:
    res = await client.post("/api/orgs/", json={"name": name, "description": "desc"}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


async def invite(client, headers, slug: str, email: str) -> str:
    res = await client.post(f"/api/orgs/{slug}/invite", json={"email": email}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["token"]


async def test_create_org_makes_creator_the_owner(client, make_user, auth_headers):
    owner = await make_user()
    headers = auth_headers(owner)

    org = await create_org(client, headers)

    assert org["slug"] == "acme-team"
    detail = (await client.get("/api/orgs/acme-team", headers=headers)).json()
    assert detail["my_role"] == "owner"
    assert detail["owner_id"] == str(owner.id)
    assert [(m["user_id"], m["role"]) for m in detail["members"]] == [(str(owner.id), "owner")]


async def test_org_slug_is_unique(client, make_user, auth_headers):
    headers = auth_headers(await make_user())

    first = await create_org(client, headers, "Acme Team")
    second = await create_org(client, headers, "Acme Team")

    assert (first["slug"], second["slug"]) == ("acme-team", "acme-team-1")


async def test_list_returns_only_my_orgs(client, make_user, auth_headers):
    mine = auth_headers(await make_user())
    theirs = auth_headers(await make_user())
    await create_org(client, mine, "Mine")
    await create_org(client, theirs, "Theirs")

    res = await client.get("/api/orgs/", headers=mine)

    assert [o["slug"] for o in res.json()] == ["mine"]


async def test_org_is_hidden_from_non_members(client, make_user, auth_headers):
    await create_org(client, auth_headers(await make_user()))
    outsider = auth_headers(await make_user())

    assert (await client.get("/api/orgs/acme-team", headers=outsider)).status_code == 403
    assert (await client.get("/api/orgs/does-not-exist", headers=outsider)).status_code == 404


async def test_orgs_require_authentication(client):
    assert (await client.get("/api/orgs/")).status_code in (401, 403)
    assert (await client.post("/api/orgs/", json={"name": "x"})).status_code in (401, 403)


async def test_invited_user_can_join_as_member(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    invitee = await make_user(email="new@example.com")
    await create_org(client, owner_headers)
    token = await invite(client, owner_headers, "acme-team", "new@example.com")

    joined = await client.get(f"/api/orgs/join/{token}", headers=auth_headers(invitee))

    assert joined.status_code == 200
    assert joined.json()["org_slug"] == "acme-team"
    detail = (await client.get("/api/orgs/acme-team", headers=auth_headers(invitee))).json()
    assert detail["my_role"] == "member"
    assert len(detail["members"]) == 2


async def test_invite_token_is_single_use(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    await create_org(client, owner_headers)
    token = await invite(client, owner_headers, "acme-team", "new@example.com")
    await client.get(f"/api/orgs/join/{token}", headers=auth_headers(await make_user()))

    second = await client.get(f"/api/orgs/join/{token}", headers=auth_headers(await make_user()))

    assert second.status_code == 404


async def test_unknown_invite_token_is_rejected(client, make_user, auth_headers):
    res = await client.get("/api/orgs/join/not-a-real-token", headers=auth_headers(await make_user()))

    assert res.status_code == 404


async def test_only_admins_can_invite(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    member = await make_user()
    await create_org(client, owner_headers)
    token = await invite(client, owner_headers, "acme-team", member.email)
    await client.get(f"/api/orgs/join/{token}", headers=auth_headers(member))

    res = await client.post(
        "/api/orgs/acme-team/invite", json={"email": "x@example.com"}, headers=auth_headers(member)
    )

    assert res.status_code == 403


async def test_duplicate_pending_invite_is_rejected(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    await create_org(client, owner_headers)
    await invite(client, owner_headers, "acme-team", "new@example.com")

    res = await client.post(
        "/api/orgs/acme-team/invite", json={"email": "new@example.com"}, headers=owner_headers
    )

    assert res.status_code == 400


async def test_existing_member_cannot_be_invited_again(client, make_user, auth_headers):
    owner = await make_user(email="owner@example.com")
    await create_org(client, auth_headers(owner))

    res = await client.post(
        "/api/orgs/acme-team/invite", json={"email": "owner@example.com"}, headers=auth_headers(owner)
    )

    assert res.status_code == 400


@pytest.mark.xfail(
    strict=True,
    reason="Bilinen hata: endpoint user_id'yi int bekliyor ama kullanıcı id'leri UUID (422 dönüyor)",
)
async def test_owner_can_remove_a_member(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    member = await make_user()
    await create_org(client, owner_headers)
    token = await invite(client, owner_headers, "acme-team", member.email)
    await client.get(f"/api/orgs/join/{token}", headers=auth_headers(member))

    res = await client.delete(f"/api/orgs/acme-team/members/{member.id}", headers=owner_headers)

    assert res.status_code == 200
