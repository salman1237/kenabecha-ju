"""Bearer-token auth alongside the existing cookies (Android app, Phase 1).

A native client has no browser cookie jar, so every session-establishing
endpoint (login, Google sign-in, refresh) now also returns access_token/
refresh_token in the JSON body, and every protected endpoint accepts
`Authorization: Bearer <token>` as a fallback when no cookie is present.
The web app's own cookie-only flow must stay byte-for-byte unchanged.
"""

from tests.conftest import TEST_PASSWORD, make_user


async def _login_get_tokens(client, user) -> dict:
    res = await client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()


# --- tokens now ride alongside the cookies ----------------------------------


async def test_login_response_body_carries_both_tokens_alongside_the_cookies(client, db):
    user = await make_user(db)
    body = await _login_get_tokens(client, user)
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert isinstance(body["refresh_token"], str) and body["refresh_token"]
    assert body["email"] == user.email
    # The cookies the web app depends on are still set — this is additive,
    # not a replacement.
    res = await client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    set_cookies = res.headers.get_list("set-cookie")
    assert any("access_token=" in c and "HttpOnly" in c for c in set_cookies)
    assert any("refresh_token=" in c and "HttpOnly" in c for c in set_cookies)


# --- bearer header as a fallback, cookie unaffected -------------------------


async def test_bearer_header_authenticates_a_protected_endpoint_with_no_cookie(client, db):
    user = await make_user(db)
    tokens = await _login_get_tokens(client, user)
    # Login left the cookie jar populated; a native client never has one at
    # all, so clear it and rely purely on the header, matching what a real
    # mobile HTTP client's request actually looks like.
    client.cookies.clear()
    res = await client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert res.status_code == 200
    assert res.json()["email"] == user.email


async def test_garbage_bearer_header_is_unauthenticated_not_a_500(client):
    res = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


async def test_missing_bearer_prefix_is_ignored_not_crashed_on(client, db):
    user = await make_user(db)
    tokens = await _login_get_tokens(client, user)
    client.cookies.clear()
    res = await client.get("/auth/me", headers={"Authorization": tokens["access_token"]})
    assert res.status_code == 401


async def test_cookie_takes_precedence_over_a_conflicting_bearer_header(client, db):
    """Both present, disagreeing — the cookie wins, matching the web app's
    own request shape exactly (a browser never sends a bearer header at
    all, so this is purely about the fallback never accidentally shadowing
    the cookie path when both happen to be present)."""
    user_a = await make_user(db)
    user_b = await make_user(db)
    tokens_b = await _login_get_tokens(client, user_b)
    # `client` now holds user_b's cookies from the login above; log in again
    # as user_a to overwrite them with user_a's session.
    await client.post("/auth/login", json={"email": user_a.email, "password": TEST_PASSWORD})
    res = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens_b['access_token']}"}
    )
    assert res.status_code == 200
    assert res.json()["email"] == user_a.email  # the cookie's identity, not the header's


# --- optional-user endpoints (e.g. shop-follow personalization) ------------


async def test_optional_user_endpoint_personalizes_via_bearer_header_too(client, db):
    user = await make_user(db)
    tokens = await _login_get_tokens(client, user)
    client.cookies.clear()
    res = await client.get("/notifications", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert res.status_code == 200


# --- refresh and logout via the header, no cookie at all -------------------


async def test_refresh_works_via_bearer_header_with_no_cookie(client, db):
    user = await make_user(db)
    tokens = await _login_get_tokens(client, user)
    client.cookies.clear()
    res = await client.post("/auth/refresh", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"] and body["refresh_token"]
    # Rotated, not reissued verbatim.
    assert body["refresh_token"] != tokens["refresh_token"]


async def test_logout_via_bearer_header_revokes_the_refresh_token(client, db):
    user = await make_user(db)
    tokens = await _login_get_tokens(client, user)
    client.cookies.clear()
    res = await client.post("/auth/logout", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res.status_code == 204
    # The now-revoked token can no longer refresh.
    res2 = await client.post("/auth/refresh", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res2.status_code == 401


async def test_refresh_with_no_cookie_and_no_header_is_401(client):
    client.cookies.clear()
    res = await client.post("/auth/refresh")
    assert res.status_code == 401
