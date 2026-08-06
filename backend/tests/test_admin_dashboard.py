"""The admin dashboard, bulk moderation, and the announcement banner.

Three things that share a screen but not much else. What they have in common
is that each is easy to make subtly wrong in a way nobody notices: a chart
that skips quiet days, a bulk action that removes twenty listings without
recording any of it, and a banner that keeps showing after it should have
gone.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

from app.models.audit import AuditAction, AuditLog
from app.models.listing import Listing, ListingStatus
from app.models.navigation import SiteSetting
from app.models.shop import Shop
from tests.conftest import login, make_listing, make_user


async def _shop(db, owner, name: str) -> Shop:
    """No factory for this in conftest yet, and one test needs a pair."""
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


@pytest.fixture
async def admin(client, db):
    user = await make_user(db, role="admin")
    await login(client, user)
    return user


# --- the dashboard -----------------------------------------------------------


async def test_dashboard_is_admin_only(client, db):
    """It aggregates over the whole platform, which is a different power from
    working a moderation queue."""
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    assert (await client.get("/admin/dashboard")).status_code == 403

    await login(client, await make_user(db, role="admin"))
    assert (await client.get("/admin/dashboard")).status_code == 200


async def test_anonymous_cannot_read_the_dashboard(client, db):
    assert (await client.get("/admin/dashboard")).status_code in (401, 403)


async def test_the_series_has_one_point_per_day_with_no_gaps(client, db, admin):
    """A quiet day that vanishes makes the line jump from Thursday to
    Saturday, which reads as steady activity across a day when there was
    none. Zero-filling is what stops the chart lying."""
    body = (await client.get("/admin/dashboard?days=14")).json()
    assert body["days"] == 14
    assert len(body["series"]) == 14

    dates = [point["date"] for point in body["series"]]
    assert dates == sorted(dates)
    assert len(set(dates)) == 14


async def test_todays_activity_lands_in_the_series(client, db, admin):
    before = (await client.get("/admin/dashboard?days=7")).json()["series"][-1]
    seller = await make_user(db)
    await make_listing(db, seller)

    after = (await client.get("/admin/dashboard?days=7")).json()["series"][-1]
    assert after["listings"] == before["listings"] + 1
    # The seller counts as a signup on the same day.
    assert after["signups"] == before["signups"] + 1


async def test_totals_pair_the_lifetime_count_with_the_window(client, db, admin):
    """A bare total says how big the site is, not whether anything is
    happening."""
    totals = (await client.get("/admin/dashboard?days=30")).json()["totals"]
    for key in ("total_users", "new_users", "total_active_listings", "new_listings"):
        assert key in totals
    assert totals["new_users"] <= totals["total_users"]


async def test_the_window_is_clamped(client, db, admin):
    """Not a guard against abuse — this is admin-only — but against someone
    typing a huge number and waiting on a scan of every row."""
    assert (await client.get("/admin/dashboard?days=100000")).status_code == 422
    assert (await client.get("/admin/dashboard?days=0")).status_code == 422


async def test_top_listings_are_the_most_viewed_active_ones(client, db, admin):
    seller = await make_user(db)
    quiet = await make_listing(db, seller, title="Quiet")
    popular = await make_listing(db, seller, title="Popular")
    sold_out = await make_listing(db, seller, title="Sold", status=ListingStatus.sold)
    quiet.view_count = 3
    popular.view_count = 99
    sold_out.view_count = 500
    await db.flush()

    top = (await client.get("/admin/dashboard")).json()["top_listings"]
    titles = [item["title"] for item in top]
    assert titles[0] == "Popular"
    # A sold listing is not an answer to "what should we put in front of
    # people?", however many views it has.
    assert "Sold" not in titles


async def test_removed_listings_do_not_inflate_the_series(client, db, admin):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    before = (await client.get("/admin/dashboard?days=7")).json()["series"][-1]["listings"]

    await client.delete(f"/admin/listings/{listing.id}")

    after = (await client.get("/admin/dashboard?days=7")).json()["series"][-1]["listings"]
    assert after == before - 1


# --- bulk moderation ---------------------------------------------------------


async def test_bulk_remove_takes_every_listing(client, db, admin):
    seller = await make_user(db)
    listings = [await make_listing(db, seller, title=f"Item {i}") for i in range(3)]

    res = await client.post(
        "/admin/listings/bulk-remove", json={"ids": [str(item.id) for item in listings]}
    )
    assert res.status_code == 200
    assert len(res.json()["succeeded"]) == 3
    assert res.json()["failed"] == []

    for item in listings:
        await db.refresh(item)
        assert item.status == ListingStatus.removed


async def test_bulk_remove_records_one_audit_entry_per_listing(client, db, admin):
    """A bulk UPDATE would be faster and would skip the audit entry and the
    seller's notification — quietly turning "remove 20" into a different
    operation from doing it 20 times. Moderation at speed is exactly when the
    record matters most."""
    seller = await make_user(db)
    listings = [await make_listing(db, seller, title=f"Bulk {i}") for i in range(3)]

    await client.post(
        "/admin/listings/bulk-remove", json={"ids": [str(item.id) for item in listings]}
    )

    labels = (
        (
            await db.execute(
                select(AuditLog.target_label).where(
                    AuditLog.action == AuditAction.LISTING_REMOVED
                )
            )
        )
        .scalars()
        .all()
    )
    assert sorted(labels) == ["Bulk 0", "Bulk 1", "Bulk 2"]


async def test_one_bad_id_does_not_stop_the_rest(client, db, admin):
    """A moderator is better served by "2 of 3 done, here is the one that
    failed" than by an error that leaves them guessing what landed."""
    import uuid as _uuid

    seller = await make_user(db)
    good = [await make_listing(db, seller) for _ in range(2)]
    missing = _uuid.uuid4()

    res = await client.post(
        "/admin/listings/bulk-remove",
        json={"ids": [str(good[0].id), str(missing), str(good[1].id)]},
    )
    body = res.json()
    assert len(body["succeeded"]) == 2
    assert [f["id"] for f in body["failed"]] == [str(missing)]

    for item in good:
        await db.refresh(item)
        assert item.status == ListingStatus.removed


async def test_a_repeated_id_is_acted_on_once(client, db, admin):
    seller = await make_user(db)
    listing = await make_listing(db, seller)

    res = await client.post(
        "/admin/listings/bulk-remove", json={"ids": [str(listing.id), str(listing.id)]}
    )
    assert res.json()["succeeded"] == [str(listing.id)]


async def test_an_empty_selection_is_refused(client, db, admin):
    assert (await client.post("/admin/listings/bulk-remove", json={"ids": []})).status_code == 400


async def test_an_oversized_selection_is_refused(client, db, admin):
    """Each item is a real transaction with a notification and possibly an
    email, so an unbounded list is a lot of mail sent from one click."""
    import uuid as _uuid

    ids = [str(_uuid.uuid4()) for _ in range(101)]
    assert (await client.post("/admin/listings/bulk-remove", json={"ids": ids})).status_code == 400


async def test_bulk_top_marks_and_unmarks(client, db, admin):
    seller = await make_user(db)
    listings = [await make_listing(db, seller) for _ in range(2)]
    ids = [str(item.id) for item in listings]

    await client.post("/admin/listings/bulk-top", json={"ids": ids, "is_top": True})
    for item in listings:
        await db.refresh(item)
        assert item.is_top is True

    await client.post("/admin/listings/bulk-top", json={"ids": ids, "is_top": False})
    for item in listings:
        await db.refresh(item)
        assert item.is_top is False


async def test_bulk_remove_shops(client, db, admin):
    owner = await make_user(db)
    shops = [await _shop(db, owner, f"Shop {i}") for i in range(2)]

    res = await client.post(
        "/admin/shops/bulk-remove", json={"ids": [str(s.id) for s in shops]}
    )
    assert len(res.json()["succeeded"]) == 2
    for shop in shops:
        await db.refresh(shop)
        assert shop.deleted_at is not None


async def test_moderators_can_use_bulk_actions(client, db):
    """Bulk is a speed-up of moderation, not a new power — the single-item
    endpoints are already open to moderators."""
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    res = await client.post("/admin/listings/bulk-remove", json={"ids": [str(listing.id)]})
    assert res.status_code == 200


async def test_anonymous_cannot_use_bulk_actions(client, db):
    import uuid as _uuid

    res = await client.post("/admin/listings/bulk-remove", json={"ids": [str(_uuid.uuid4())]})
    assert res.status_code in (401, 403)


# --- the announcement banner -------------------------------------------------


async def _clear(db):
    await db.execute(delete(SiteSetting).where(SiteSetting.key == "announcement"))
    await db.flush()


async def test_no_announcement_by_default(client, db, admin):
    await _clear(db)
    assert (await client.get("/navigation")).json()["announcement"] is None


async def test_an_active_announcement_reaches_the_public_payload(client, db, admin):
    await client.put(
        "/admin/announcement",
        json={"message": {"en": "Closed Friday", "bn": "শুক্রবার বন্ধ"}, "is_active": True},
    )

    banner = (await client.get("/navigation")).json()["announcement"]
    assert banner["message"] == {"en": "Closed Friday", "bn": "শুক্রবার বন্ধ"}
    assert banner["dismissible"] is True


async def test_an_inactive_announcement_is_not_published(client, db, admin):
    await client.put(
        "/admin/announcement", json={"message": {"en": "Draft"}, "is_active": False}
    )
    assert (await client.get("/navigation")).json()["announcement"] is None


async def test_an_empty_message_is_not_published(client, db, admin):
    """Switching it on with nothing written would render an empty bar across
    the top of every page."""
    await client.put("/admin/announcement", json={"message": {"en": "  "}, "is_active": True})
    assert (await client.get("/navigation")).json()["announcement"] is None


async def test_a_future_announcement_is_not_published_yet(client, db, admin):
    """Scheduling is checked on the server: a device with a wrong clock would
    otherwise show a maintenance notice a day early."""
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    await client.put(
        "/admin/announcement",
        json={"message": {"en": "Soon"}, "is_active": True, "starts_at": tomorrow},
    )
    assert (await client.get("/navigation")).json()["announcement"] is None


async def test_an_expired_announcement_is_not_published(client, db, admin):
    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    await client.put(
        "/admin/announcement",
        json={"message": {"en": "Over"}, "is_active": True, "ends_at": yesterday},
    )
    assert (await client.get("/navigation")).json()["announcement"] is None


async def test_an_announcement_inside_its_window_is_published(client, db, admin):
    now = datetime.now(UTC)
    await client.put(
        "/admin/announcement",
        json={
            "message": {"en": "Live now"},
            "is_active": True,
            "starts_at": (now - timedelta(hours=1)).isoformat(),
            "ends_at": (now + timedelta(hours=1)).isoformat(),
        },
    )
    assert (await client.get("/navigation")).json()["announcement"]["message"] == {
        "en": "Live now"
    }


async def test_a_malformed_date_does_not_hide_a_live_announcement(client, db, admin):
    """Treating it as absent keeps the other bound working, which is better
    than a banner that silently never appears."""
    await client.put(
        "/admin/announcement",
        json={"message": {"en": "Still live"}, "is_active": True, "starts_at": "not a date"},
    )
    assert (await client.get("/navigation")).json()["announcement"] is not None


async def test_changing_the_wording_bumps_the_version(client, db, admin):
    """Otherwise anyone who dismissed the last banner would never see the
    next one — which for a maintenance notice is the one that mattered."""
    first = (
        await client.put(
            "/admin/announcement", json={"message": {"en": "One"}, "is_active": True}
        )
    ).json()
    second = (
        await client.put("/admin/announcement", json={"message": {"en": "Two"}})
    ).json()
    assert second["version"] == first["version"] + 1


async def test_a_schedule_change_does_not_bump_the_version(client, db, admin):
    """Re-nagging everyone because a date moved would train them to ignore
    the banner."""
    first = (
        await client.put(
            "/admin/announcement", json={"message": {"en": "Same"}, "is_active": True}
        )
    ).json()
    second = (
        await client.put(
            "/admin/announcement", json={"ends_at": datetime.now(UTC).isoformat()}
        )
    ).json()
    assert second["version"] == first["version"]


async def test_an_unknown_variant_falls_back(client, db, admin):
    res = await client.put(
        "/admin/announcement", json={"message": {"en": "Hi"}, "variant": "chartreuse"}
    )
    assert res.json()["variant"] == "info"


async def test_only_admins_can_set_an_announcement(client, db):
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    assert (await client.get("/admin/announcement")).status_code == 403
    assert (
        await client.put("/admin/announcement", json={"message": {"en": "Nope"}})
    ).status_code == 403


async def test_setting_an_announcement_is_audited(client, db, admin):
    await client.put(
        "/admin/announcement", json={"message": {"en": "Recorded"}, "is_active": True}
    )
    entry = (
        await db.execute(
            select(AuditLog).where(AuditLog.action == AuditAction.ANNOUNCEMENT_CHANGED)
        )
    ).scalars().first()
    assert entry is not None
    assert entry.detail["to"]["message"] == {"en": "Recorded"}
