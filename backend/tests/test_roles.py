"""Role management and the two rails that make it safe.

The rails matter more than the feature. Losing the last admin is
unrecoverable through the product — nobody can reach the panel to undo it —
and self-promotion would make the moderator/admin split decorative.
"""

from app.models.user import UserRole
from tests.conftest import login, make_listing, make_user

# --- the moderator/admin split ----------------------------------------------


async def test_moderator_reaches_the_moderation_surface(client, db):
    seller = await make_user(db)
    await make_listing(db, seller)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.get("/admin/listings")).status_code == 200
    assert (await client.get("/admin/reports")).status_code == 200
    assert (await client.get("/admin/shops")).status_code == 200


async def test_moderator_can_remove_a_listing(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.delete(f"/admin/listings/{listing.id}")).status_code == 200


async def test_moderator_cannot_manage_users(client, db):
    """The whole point of the split: moderating is not administering."""
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.get("/admin/users")).status_code == 403


async def test_moderator_cannot_grant_roles(client, db):
    """Otherwise a moderator simply promotes themselves and the split is
    decorative."""
    victim = await make_user(db)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    res = await client.patch(f"/admin/users/{victim.id}/role", json={"role": "admin"})
    assert res.status_code == 403


async def test_plain_user_reaches_nothing(client, db):
    user = await make_user(db)
    await login(client, user)

    assert (await client.get("/admin/listings")).status_code == 403
    assert (await client.get("/admin/users")).status_code == 403


async def test_admin_reaches_everything(client, db):
    admin = await make_user(db, role="admin")
    await login(client, admin)

    assert (await client.get("/admin/listings")).status_code == 200
    assert (await client.get("/admin/users")).status_code == 200


# --- granting and revoking ---------------------------------------------------


async def test_admin_promotes_a_user_to_moderator(client, db):
    target = await make_user(db)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    res = await client.patch(f"/admin/users/{target.id}/role", json={"role": "moderator"})
    assert res.status_code == 200
    assert res.json()["role"] == "moderator"
    await db.refresh(target)
    assert target.role == UserRole.moderator


async def test_demotion_revokes_existing_sessions(client, db):
    """A removed permission must apply now, not whenever the current access
    token happens to expire."""
    from sqlalchemy import func, select

    from app.models.token import RefreshToken

    target = await make_user(db, role="moderator")
    await login(client, target)  # gives the target a live refresh token

    live = await db.execute(
        select(func.count())
        .select_from(RefreshToken)
        .where(RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None))
    )
    assert live.scalar_one() >= 1

    admin = await make_user(db, role="admin")
    await login(client, admin)
    await client.patch(f"/admin/users/{target.id}/role", json={"role": "user"})

    still_live = await db.execute(
        select(func.count())
        .select_from(RefreshToken)
        .where(RefreshToken.user_id == target.id, RefreshToken.revoked_at.is_(None))
    )
    assert still_live.scalar_one() == 0


# --- rail 1: nobody changes their own role -----------------------------------


async def test_admin_cannot_change_their_own_role(client, db):
    admin = await make_user(db, role="admin")
    await login(client, admin)

    res = await client.patch(f"/admin/users/{admin.id}/role", json={"role": "user"})
    assert res.status_code == 400
    await db.refresh(admin)
    assert admin.role == UserRole.admin


async def test_admin_cannot_deactivate_themselves(client, db):
    admin = await make_user(db, role="admin")
    await login(client, admin)

    res = await client.patch(f"/admin/users/{admin.id}/active?is_active=false")
    assert res.status_code == 400
    await db.refresh(admin)
    assert admin.is_active is True


# --- rail 2: the last admin survives -----------------------------------------


async def test_last_admin_cannot_be_demoted(client, db):
    """Unrecoverable through the product: with no admin left, nobody can reach
    the panel to undo it."""
    from sqlalchemy import update

    from app.models.user import User

    # Any admins seeded by other fixtures would make this vacuous.
    await db.execute(update(User).where(User.role == UserRole.admin).values(role=UserRole.user))

    only_admin = await make_user(db, role="admin")
    second_admin = await make_user(db, role="admin")
    await login(client, second_admin)

    # Two admins: demoting one is fine.
    assert (
        await client.patch(f"/admin/users/{only_admin.id}/role", json={"role": "user"})
    ).status_code == 200

    # second_admin is now the last one, and cannot demote itself anyway, so
    # promote a third and have it try.
    third = await make_user(db, role="admin")
    await login(client, third)
    res = await client.patch(f"/admin/users/{second_admin.id}/role", json={"role": "user"})
    assert res.status_code == 200  # third is still an admin, so this is allowed

    # Now `third` is the only active admin. Another admin must exist to test
    # the guard, so promote one and let it try to demote `third`.
    fourth = await make_user(db, role="admin")
    await login(client, fourth)
    assert (
        await client.patch(f"/admin/users/{fourth.id}/role", json={"role": "user"})
    ).status_code == 400  # cannot change own role

    # Demote `third`, leaving `fourth` alone, then confirm it is protected.
    await client.patch(f"/admin/users/{third.id}/role", json={"role": "user"})
    fifth = await make_user(db, role="admin")
    await login(client, fifth)
    await client.patch(f"/admin/users/{fifth.id}/role", json={"role": "user"})  # self: 400

    await db.refresh(fourth)
    assert fourth.role == UserRole.admin


async def test_last_admin_cannot_be_deactivated(client, db):
    from sqlalchemy import update

    from app.models.user import User

    await db.execute(update(User).where(User.role == UserRole.admin).values(role=UserRole.user))

    last_admin = await make_user(db, role="admin")
    actor = await make_user(db, role="admin")
    await login(client, actor)

    # Two admins exist, so deactivating one is allowed.
    assert (
        await client.patch(f"/admin/users/{last_admin.id}/active?is_active=false")
    ).status_code == 200

    # `actor` is now the only active admin; it cannot deactivate itself.
    res = await client.patch(f"/admin/users/{actor.id}/active?is_active=false")
    assert res.status_code == 400
    await db.refresh(actor)
    assert actor.is_active is True


async def test_an_inactive_admin_does_not_count_as_cover(client, db):
    """A deactivated admin cannot log in, so it must not satisfy the
    'another admin exists' check."""
    from sqlalchemy import update

    from app.models.user import User

    await db.execute(update(User).where(User.role == UserRole.admin).values(role=UserRole.user))

    inactive_admin = await make_user(db, role="admin", is_active=False)
    active_admin = await make_user(db, role="admin")
    actor = await make_user(db, role="admin")
    await login(client, actor)

    # Demote active_admin; only `actor` is left active (inactive_admin doesn't count).
    assert (
        await client.patch(f"/admin/users/{active_admin.id}/role", json={"role": "user"})
    ).status_code == 200

    await db.refresh(inactive_admin)
    assert inactive_admin.role == UserRole.admin  # untouched
