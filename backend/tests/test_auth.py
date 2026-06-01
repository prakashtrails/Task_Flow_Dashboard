import pytest

from tests.conftest import auth_header, login


async def test_login_success(client, users):
    token = await login(client, "alex@test.dev")
    assert token

    me = await client.get("/api/v1/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["email"] == "alex@test.dev"
    assert me.json()["avatar"] == "AM"


async def test_login_bad_password(client, users):
    resp = await client.post(
        "/api/v1/auth/login", json={"email": "alex@test.dev", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_protected_requires_token(client, users):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_refresh_rotation(client, users):
    login_resp = await client.post(
        "/api/v1/auth/login", json={"email": "alex@test.dev", "password": "password123"}
    )
    refresh = login_resp.json()["refresh_token"]
    r1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r1.status_code == 200
    # old refresh token is now revoked
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 401


async def test_assignee_cannot_list_all_users(client, users):
    token = await login(client, "jordan@test.dev")
    resp = await client.get("/api/v1/users", headers=auth_header(token))
    assert resp.status_code == 403
