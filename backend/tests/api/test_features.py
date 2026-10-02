FEATURE = {
    "repo_full_name": "octocat/hello",
    "title": "Dark mode",
    "description": "Add a dark theme",
    "priority": "high",
    "effort": "low",
    "seen_in": ["vercel/next.js", "facebook/react"],
}


async def save_feature(client, headers, **overrides) -> dict:
    res = await client.post("/api/features/", json={**FEATURE, **overrides}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


async def test_saved_feature_is_returned_with_defaults(client, make_user, auth_headers):
    headers = auth_headers(await make_user())

    feature = await save_feature(client, headers)

    assert feature["status"] == "pending"
    assert feature["seen_in"] == ["vercel/next.js", "facebook/react"]
    listed = (await client.get("/api/features/", headers=headers)).json()["features"]
    assert [f["id"] for f in listed] == [feature["id"]]


async def test_status_can_be_updated(client, make_user, auth_headers):
    headers = auth_headers(await make_user())
    feature = await save_feature(client, headers)

    res = await client.patch(f"/api/features/{feature['id']}", json={"status": "done"}, headers=headers)

    assert res.status_code == 200
    assert res.json()["status"] == "done"


async def test_invalid_status_is_rejected(client, make_user, auth_headers):
    headers = auth_headers(await make_user())
    feature = await save_feature(client, headers)

    res = await client.patch(f"/api/features/{feature['id']}", json={"status": "archived"}, headers=headers)

    assert res.status_code == 422


async def test_counts_only_include_pending_features(client, make_user, auth_headers):
    headers = auth_headers(await make_user())
    await save_feature(client, headers, title="A")
    done = await save_feature(client, headers, title="B")
    await save_feature(client, headers, title="C", repo_full_name="octocat/other")
    await client.patch(f"/api/features/{done['id']}", json={"status": "done"}, headers=headers)

    res = await client.get("/api/features/counts", headers=headers)

    assert res.json() == {"counts": {"octocat/hello": 1, "octocat/other": 1}}


async def test_features_are_private_to_each_user(client, make_user, auth_headers):
    owner_headers = auth_headers(await make_user())
    other_headers = auth_headers(await make_user())
    feature = await save_feature(client, owner_headers)

    assert (await client.get("/api/features/", headers=other_headers)).json()["features"] == []
    patched = await client.patch(
        f"/api/features/{feature['id']}", json={"status": "done"}, headers=other_headers
    )
    assert patched.status_code == 404
    assert (await client.delete(f"/api/features/{feature['id']}", headers=other_headers)).status_code == 404
    # Sahibi için kayıt hâlâ duruyor
    assert len((await client.get("/api/features/", headers=owner_headers)).json()["features"]) == 1


async def test_owner_can_delete_feature(client, make_user, auth_headers):
    headers = auth_headers(await make_user())
    feature = await save_feature(client, headers)

    assert (await client.delete(f"/api/features/{feature['id']}", headers=headers)).status_code == 200
    assert (await client.get("/api/features/", headers=headers)).json()["features"] == []
