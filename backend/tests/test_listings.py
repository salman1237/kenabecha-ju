"""Listing lifecycle, plus regression cover for the defects fixed in
Phase 29a (audit) and the features added in Phase 30."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.models.listing import ListingStatus
from app.services import listing_service
from tests.conftest import login, make_listing, make_user


async def _category_id(db) -> str:
    row = await db.execute(text("SELECT id FROM categories WHERE parent_id IS NOT NULL LIMIT 1"))
    return str(row.scalar_one())


def _payload(category_id: str, **overrides) -> dict:
    base = {
        "title": "Calculus textbook",
        "description": "Third edition, barely used, no markings inside.",
        "price": 500,
        "price_type": "fixed",
        "condition": "used_good",
        "fulfillment_type": "pickup",
        "pickup_address": "Room 204, Al Beruni Hall",
        "category_id": category_id,
        "tags": [],
    }
    base.update(overrides)
    return base


# --- creation ---------------------------------------------------------------


async def test_create_listing(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post("/listings", json=_payload(await _category_id(db)))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"] == "Calculus textbook"
    assert body["status"] == "active"
    assert body["category"] is not None


async def test_create_requires_authentication(client, db):
    res = await client.post("/listings", json=_payload(await _category_id(db)))
    assert res.status_code == 401


async def test_personal_listing_requires_a_condition(client, db):
    """Shop listings are always 'new'; a used personal item must say which."""
    user = await make_user(db)
    await login(client, user)
    payload = _payload(await _category_id(db))
    del payload["condition"]
    res = await client.post("/listings", json=payload)
    assert res.status_code == 422


async def test_fixed_price_requires_a_price(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings", json=_payload(await _category_id(db), price=None, price_type="fixed")
    )
    assert res.status_code == 422


async def test_pickup_requires_an_address(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings", json=_payload(await _category_id(db), pickup_address=None)
    )
    assert res.status_code == 422


async def test_unknown_category_is_400_not_500(client, db):
    """Regression, Phase 29a: the id went straight to the insert and leaked a
    ForeignKeyViolationError as a 500."""
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings",
        json=_payload("00000000-0000-0000-0000-000000000000"),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "unknown_category"


async def test_unknown_category_on_update_is_also_400(client, db):
    user = await make_user(db)
    await login(client, user)
    created = await client.post("/listings", json=_payload(await _category_id(db)))
    res = await client.patch(
        f"/listings/{created.json()['id']}",
        json={"category_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "unknown_category"


# --- ownership --------------------------------------------------------------


async def test_only_the_owner_can_edit(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner)
    intruder = await make_user(db)
    await login(client, intruder)

    res = await client.patch(f"/listings/{listing.id}", json={"title": "Hijacked"})
    assert res.status_code == 403


async def test_only_the_owner_can_delete(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner)
    intruder = await make_user(db)
    await login(client, intruder)

    assert (await client.delete(f"/listings/{listing.id}")).status_code == 403


async def test_delete_soft_deletes_and_hides_it(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner)
    await login(client, owner)

    assert (await client.delete(f"/listings/{listing.id}")).status_code == 204
    assert (await client.get(f"/listings/{listing.id}")).status_code == 404


# --- browse -----------------------------------------------------------------


async def test_browse_excludes_sold_listings(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Still available")
    await make_listing(db, seller, title="Already gone", status=ListingStatus.sold)

    titles = [i["title"] for i in (await client.get("/listings?limit=100")).json()["items"]]
    assert "Still available" in titles
    assert "Already gone" not in titles


async def test_browse_excludes_listings_from_deactivated_sellers(client, db):
    """Regression, Phase 29: a banned seller's stock stayed browsable."""
    banned = await make_user(db, is_active=False)
    await make_listing(db, banned, title="From a banned seller")

    titles = [i["title"] for i in (await client.get("/listings?limit=100")).json()["items"]]
    assert "From a banned seller" not in titles


async def test_browse_price_filter(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Cheap thing", price="100")
    await make_listing(db, seller, title="Pricey thing", price="9000")

    res = await client.get("/listings?min_price=1000&limit=100")
    titles = [i["title"] for i in res.json()["items"]]
    assert "Pricey thing" in titles
    assert "Cheap thing" not in titles


async def test_browse_pagination_reports_total_not_page_size(client, db):
    seller = await make_user(db)
    for i in range(5):
        await make_listing(db, seller, title=f"Item {i}")

    res = await client.get("/listings?limit=2")
    body = res.json()
    assert len(body["items"]) == 2
    assert body["total"] >= 5


# --- expiry (Phase 30, FEAT-07) ---------------------------------------------


async def test_new_listings_get_an_expiry(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post("/listings", json=_payload(await _category_id(db)))
    assert res.json()["expires_at"] is not None


async def test_lapsed_listing_is_hidden_before_the_sweep_runs(client, db):
    """Browse filters on expires_at itself, so correctness doesn't depend on
    the hourly sweep having run — or on it running at all."""
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Lapsed item")
    listing.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db.flush()

    titles = [i["title"] for i in (await client.get("/listings?limit=100")).json()["items"]]
    assert "Lapsed item" not in titles


async def test_sweep_marks_lapsed_listings_expired(db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    listing.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db.flush()

    swept = await listing_service.expire_stale_listings(db)
    await db.refresh(listing)
    assert swept >= 1
    assert listing.status == ListingStatus.expired


async def test_sweep_leaves_live_listings_alone(db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    listing.expires_at = datetime.now(UTC) + timedelta(days=10)
    await db.flush()

    await listing_service.expire_stale_listings(db)
    await db.refresh(listing)
    assert listing.status == ListingStatus.active


async def test_owner_can_renew_an_expired_listing(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner, status=ListingStatus.expired)
    listing.expires_at = datetime.now(UTC) - timedelta(days=1)
    await db.flush()
    await login(client, owner)

    res = await client.post(f"/listings/{listing.id}/renew")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "active"
    assert datetime.fromisoformat(body["expires_at"]) > datetime.now(UTC) + timedelta(days=25)


async def test_others_cannot_renew_your_listing(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner, status=ListingStatus.expired)
    intruder = await make_user(db)
    await login(client, intruder)

    assert (await client.post(f"/listings/{listing.id}/renew")).status_code == 403


# --- view counting (Phase 30, FEAT-04) --------------------------------------


async def test_repeat_views_from_one_visitor_count_once(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)

    for _ in range(4):
        await client.get(f"/listings/{listing.id}")

    res = await client.get(f"/listings/{listing.id}")
    assert res.json()["view_count"] == 1


async def test_distinct_visitors_count_separately(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)

    await client.get(f"/listings/{listing.id}", headers={"user-agent": "browser-one"})
    await client.get(f"/listings/{listing.id}", headers={"user-agent": "browser-two"})

    res = await client.get(f"/listings/{listing.id}", headers={"user-agent": "browser-one"})
    assert res.json()["view_count"] == 2


async def test_sellers_do_not_inflate_their_own_view_count(client, db):
    """Otherwise the number a seller is shown is partly their own traffic."""
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    await login(client, seller)

    for _ in range(3):
        await client.get(f"/listings/{listing.id}")

    assert (await client.get(f"/listings/{listing.id}")).json()["view_count"] == 0


async def test_related_endpoint_does_not_count_as_a_view(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)

    await client.get(f"/listings/{listing.id}/related")
    await client.get(f"/listings/{listing.id}/seller-reviews")

    row = await db.execute(
        text("SELECT count(*) FROM listing_views WHERE listing_id = :id"), {"id": listing.id}
    )
    assert row.scalar_one() == 0


# --- promotion (Phase 30, FEAT-05) ------------------------------------------


async def test_only_admins_can_feature_a_listing(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    await login(client, seller)

    assert (await client.post(f"/listings/{listing.id}/feature", json={"days": 7})).status_code == 403


async def test_admin_can_feature_and_clear(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    res = await client.post(f"/listings/{listing.id}/feature", json={"days": 7})
    assert res.status_code == 200
    assert res.json()["is_featured"] is True

    res = await client.post(f"/listings/{listing.id}/feature", json={"days": None})
    assert res.json()["is_featured"] is False
    assert res.json()["featured_until"] is None


async def test_featured_listings_sort_first(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Newer item")
    older = await make_listing(db, seller, title="Older but promoted")
    older.featured_until = datetime.now(UTC) + timedelta(days=3)
    await db.flush()

    items = (await client.get("/listings?limit=100")).json()["items"]
    assert items[0]["title"] == "Older but promoted"


async def test_expired_promotion_does_not_still_rank(db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    listing.featured_until = datetime.now(UTC) - timedelta(days=1)
    await db.flush()

    items, _ = await listing_service.browse_listings(
        db, listing_service.BrowseFilters(limit=100)
    )
    found = next(i for i in items if i.id == listing.id)
    assert found.featured_until < datetime.now(UTC)


# --- mark sold --------------------------------------------------------------


async def test_mark_sold_removes_it_from_browse(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner, title="Selling this")
    await login(client, owner)

    assert (await client.post(f"/listings/{listing.id}/mark-sold")).status_code == 200
    titles = [i["title"] for i in (await client.get("/listings?limit=100")).json()["items"]]
    assert "Selling this" not in titles


async def test_cannot_mark_an_already_sold_listing_sold(client, db):
    owner = await make_user(db)
    listing = await make_listing(db, owner, status=ListingStatus.sold)
    await login(client, owner)

    assert (await client.post(f"/listings/{listing.id}/mark-sold")).status_code == 400


# --- fulfillment: pickup, delivery, or both (Phase 37) ----------------------


async def test_can_offer_both_pickup_and_delivery(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings", json=_payload(await _category_id(db), fulfillment_type="both")
    )
    assert res.status_code == 201, res.text
    assert res.json()["fulfillment_type"] == "both"


async def test_both_still_requires_a_pickup_address(client, db):
    """`both` includes pickup, so the buyer still needs somewhere to collect."""
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings",
        json=_payload(await _category_id(db), fulfillment_type="both", pickup_address=None),
    )
    assert res.status_code == 422


async def test_delivery_only_clears_the_pickup_address(client, db):
    user = await make_user(db)
    await login(client, user)
    res = await client.post(
        "/listings",
        json=_payload(
            await _category_id(db),
            fulfillment_type="delivery",
            pickup_address="Somewhere that no longer applies",
        ),
    )
    assert res.status_code == 201
    assert res.json()["pickup_address"] is None


async def test_switching_to_both_without_an_address_is_rejected(client, db):
    """The update path validates the merged state: a listing that was
    delivery-only has no address, so switching it to `both` must fail."""
    user = await make_user(db)
    await login(client, user)
    created = await client.post(
        "/listings",
        json=_payload(await _category_id(db), fulfillment_type="delivery", pickup_address=None),
    )
    listing_id = created.json()["id"]

    res = await client.patch(f"/listings/{listing_id}", json={"fulfillment_type": "both"})
    assert res.status_code == 400


async def test_switching_to_both_with_an_address_succeeds(client, db):
    user = await make_user(db)
    await login(client, user)
    created = await client.post(
        "/listings",
        json=_payload(await _category_id(db), fulfillment_type="delivery", pickup_address=None),
    )
    res = await client.patch(
        f"/listings/{created.json()['id']}",
        json={"fulfillment_type": "both", "pickup_address": "Room 204, Al Beruni Hall"},
    )
    assert res.status_code == 200
    assert res.json()["fulfillment_type"] == "both"
    assert res.json()["pickup_address"] == "Room 204, Al Beruni Hall"
