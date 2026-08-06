"""Authentication behaviour, including the machine-readable error codes the
frontend translates (Phase 31, I18N-04)."""

from sqlalchemy import text

from tests.conftest import TEST_PASSWORD, make_user


async def test_login_succeeds_and_sets_cookies(client, db):
    user = await make_user(db)
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": TEST_PASSWORD}
    )
    assert res.status_code == 200
    assert res.json()["email"] == user.email
    # Session must be cookie-based and the cookie must not be JS-readable.
    set_cookies = res.headers.get_list("set-cookie")
    assert any("access_token=" in c and "HttpOnly" in c for c in set_cookies)
    assert any("refresh_token=" in c and "HttpOnly" in c for c in set_cookies)


async def test_login_never_echoes_the_password_hash(client, db):
    user = await make_user(db)
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": TEST_PASSWORD}
    )
    assert "hashed_password" not in res.text
    assert "password" not in res.json()


async def test_wrong_password_is_401_with_code(client, db):
    user = await make_user(db)
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": "WrongPassword1!"}
    )
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


async def test_unknown_email_gives_the_same_answer_as_a_wrong_password(client, db):
    """Distinguishable responses would let an attacker enumerate accounts."""
    await make_user(db)
    res = await client.post(
        "/auth/login", json={"email": "nobody@juniv.edu", "password": "WrongPassword1!"}
    )
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


async def test_unverified_account_cannot_log_in(client, db):
    user = await make_user(db, is_verified=False)
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": TEST_PASSWORD}
    )
    assert res.status_code == 403
    assert res.json()["code"] == "email_not_verified"


async def test_deactivated_account_cannot_log_in(client, db):
    user = await make_user(db, is_active=False)
    res = await client.post(
        "/auth/login", json={"email": user.email, "password": TEST_PASSWORD}
    )
    assert res.status_code == 403


async def test_duplicate_email_signup_is_rejected_with_code(client, db):
    existing = await make_user(db)
    hall = (await db.execute(text("SELECT id FROM halls LIMIT 1"))).scalar_one()
    dept = (await db.execute(text("SELECT id FROM departments LIMIT 1"))).scalar_one()

    res = await client.post(
        "/auth/signup",
        json={
            "email": existing.email,
            "password": "AnotherPass123!",
            "full_name": "Someone Else",
            "phone": "01712345678",
            "student_id": "sid-unique-1",
            "registration_no": "reg-unique-1",
            "hall_id": str(hall),
            "department_id": str(dept),
            "session": "2020-21",
        },
    )
    assert res.status_code == 409
    assert res.json()["code"] == "email_taken"


async def test_me_requires_authentication(client):
    res = await client.get("/auth/me")
    assert res.status_code == 401


async def test_me_returns_the_logged_in_user(client, db):
    user = await make_user(db)
    await client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    res = await client.get("/auth/me")
    assert res.status_code == 200
    assert res.json()["id"] == str(user.id)


async def test_logout_clears_the_session(client, db):
    user = await make_user(db)
    await client.post("/auth/login", json={"email": user.email, "password": TEST_PASSWORD})
    assert (await client.get("/auth/me")).status_code == 200

    await client.post("/auth/logout")
    assert (await client.get("/auth/me")).status_code == 401
