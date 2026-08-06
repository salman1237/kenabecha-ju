"""The audit log.

Three properties matter more than the feature itself: an entry appears when
an action succeeds, no entry appears when it fails, and the entry stays
readable after the people and things it names are gone.
"""

from sqlalchemy import func, select

from app.models.audit import AuditAction, AuditLog
from tests.conftest import login, make_listing, make_user


async def _entries(db, action: str | None = None) -> list[AuditLog]:
    q = select(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.where(AuditLog.action == action)
    return list((await db.execute(q)).scalars().all())


# --- written on success ------------------------------------------------------


async def test_role_change_is_recorded_with_before_and_after(client, db):
    target = await make_user(db)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    await client.patch(f"/admin/users/{target.id}/role", json={"role": "moderator"})

    entry = (await _entries(db, AuditAction.USER_ROLE_CHANGED))[0]
    assert entry.actor_email == admin.email
    assert entry.target_id == target.id
    assert entry.detail == {"from": "user", "to": "moderator"}


async def test_deactivation_is_recorded(client, db):
    target = await make_user(db)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    await client.patch(f"/admin/users/{target.id}/active?is_active=false")

    entry = (await _entries(db, AuditAction.USER_DEACTIVATED))[0]
    assert entry.target_label == target.email
    assert entry.actor_role == "admin"


async def test_listing_removal_is_recorded_by_a_moderator(client, db):
    """Moderators are exactly why this exists."""
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Removed by a moderator")
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    await client.delete(f"/admin/listings/{listing.id}")

    entry = (await _entries(db, AuditAction.LISTING_REMOVED))[0]
    assert entry.actor_email == moderator.email
    assert entry.actor_role == "moderator"
    assert entry.target_label == "Removed by a moderator"


# --- absent on failure -------------------------------------------------------


async def test_a_refused_action_records_nothing(client, db):
    """The entry shares the action's transaction, so a rejected change must
    leave no trace. Otherwise the log would show things that never happened."""
    admin = await make_user(db, role="admin")
    await login(client, admin)
    before = len(await _entries(db))

    # Refused by the self-change rail.
    res = await client.patch(f"/admin/users/{admin.id}/role", json={"role": "user"})
    assert res.status_code == 400

    assert len(await _entries(db)) == before


async def test_an_unauthorised_action_records_nothing(client, db):
    target = await make_user(db)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    before = len(await _entries(db))

    res = await client.patch(f"/admin/users/{target.id}/role", json={"role": "admin"})
    assert res.status_code == 403

    assert len(await _entries(db)) == before


# --- survives deletion -------------------------------------------------------


async def test_entry_survives_the_actor_being_deleted(client, db):
    """A deleted actor must not turn their history into anonymous rows —
    which is the whole reason email and role are snapshotted rather than
    read through the relationship."""
    target = await make_user(db)
    admin = await make_user(db, role="admin")
    admin_email = admin.email
    await login(client, admin)
    await client.patch(f"/admin/users/{target.id}/role", json={"role": "moderator"})

    await db.delete(admin)
    await db.flush()

    entry = (await _entries(db, AuditAction.USER_ROLE_CHANGED))[0]
    assert entry.actor_id is None          # FK cleared by ON DELETE SET NULL
    assert entry.actor_email == admin_email  # but we still know who it was
    assert entry.actor_role == "admin"


async def test_entry_survives_the_target_being_deleted(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Gone entirely")
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    await client.delete(f"/admin/listings/{listing.id}")

    from app.models.listing import Listing, listing_tags
    from sqlalchemy import delete as sqldelete

    await db.execute(sqldelete(listing_tags).where(listing_tags.c.listing_id == listing.id))
    await db.delete(listing)
    await db.flush()

    entry = (await _entries(db, AuditAction.LISTING_REMOVED))[0]
    assert entry.target_label == "Gone entirely"  # no FK, so nothing cascaded


# --- reading it --------------------------------------------------------------


async def test_only_admins_can_read_the_log(client, db):
    """A moderator whose own actions are recorded should not be able to read
    the record of everyone else's."""
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    assert (await client.get("/admin/audit")).status_code == 403

    admin = await make_user(db, role="admin")
    await login(client, admin)
    assert (await client.get("/admin/audit")).status_code == 200


async def test_log_can_be_filtered_by_action_and_actor(client, db):
    target = await make_user(db)
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    await client.patch(f"/admin/users/{target.id}/role", json={"role": "moderator"})
    await client.delete(f"/admin/listings/{listing.id}")

    by_action = await client.get(f"/admin/audit?action={AuditAction.USER_ROLE_CHANGED}")
    assert by_action.status_code == 200
    assert all(i["action"] == AuditAction.USER_ROLE_CHANGED for i in by_action.json()["items"])

    by_actor = await client.get(f"/admin/audit?actor_id={admin.id}")
    assert by_actor.json()["total"] >= 2

    actions = await client.get("/admin/audit/actions")
    assert AuditAction.USER_ROLE_CHANGED in actions.json()


async def test_newest_entries_come_first(client, db):
    a = await make_user(db)
    b = await make_user(db)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    await client.patch(f"/admin/users/{a.id}/role", json={"role": "moderator"})
    await client.patch(f"/admin/users/{b.id}/role", json={"role": "moderator"})

    items = (await client.get("/admin/audit")).json()["items"]
    assert items[0]["target_label"] == b.email


async def test_there_is_no_way_to_delete_an_entry(client, db):
    """Append-only is the point. If this ever starts returning 200 or 204,
    the trail has stopped being one."""
    admin = await make_user(db, role="admin")
    await login(client, admin)
    target = await make_user(db)
    await client.patch(f"/admin/users/{target.id}/role", json={"role": "moderator"})

    entry = (await _entries(db))[0]
    for method, path in (
        ("delete", f"/admin/audit/{entry.id}"),
        ("patch", f"/admin/audit/{entry.id}"),
        ("delete", "/admin/audit"),
    ):
        res = await getattr(client, method)(path)
        assert res.status_code in (404, 405), f"{method} {path} returned {res.status_code}"

    assert (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one() >= 1
