"""Seller-controlled listing status (Phase 53): manual out-of-stock,
relisting, pause/reactivate, per-shop display order, and the restock
requests that ride on top of the out-of-stock toggle.
"""

import pytest
from sqlalchemy import select, text

from app.models.listing import ListingRestockRequest, ListingStatus
from app.models.shop import Shop
from tests.conftest import login, make_listing, make_user


async def _category_id(db) -> str:
    row = await db.execute(text("SELECT id FROM categories WHERE parent_id IS NOT NULL LIMIT 1"))
    return str(row.scalar_one())


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


# --- manual out-of-stock -----------------------------------------------------


async def test_mark_out_of_stock_and_back(client, db):
    """Works for a personal listing — the gap the old quantity-only
    mechanism had, since personal listings never had a quantity concept."""
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    await login(client, seller)

    res = await client.post(f"/listings/{listing.id}/mark-out-of-stock")
    assert res.status_code == 200
    assert res.json()["status"] == "out_of_stock"

    res = await client.post(f"/listings/{listing.id}/mark-available")
    assert res.status_code == 200
    assert res.json()["status"] == "active"


async def test_mark_out_of_stock_refused_unless_active(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.sold)
    await login(client, seller)
    assert (
        await client.post(f"/listings/{listing.id}/mark-out-of-stock")
    ).status_code == 400


async def test_mark_available_refused_unless_out_of_stock(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.active)
    await login(client, seller)
    assert (await client.post(f"/listings/{listing.id}/mark-available")).status_code == 400


async def test_only_the_owner_can_change_stock_status(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    other = await make_user(db)
    await login(client, other)
    assert (
        await client.post(f"/listings/{listing.id}/mark-out-of-stock")
    ).status_code == 403


# --- relist -------------------------------------------------------------


async def test_relist_undoes_sold(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.sold)
    await login(client, seller)
    res = await client.post(f"/listings/{listing.id}/relist")
    assert res.status_code == 200
    assert res.json()["status"] == "active"


async def test_relist_undoes_pause(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.paused)
    await login(client, seller)
    assert (await client.post(f"/listings/{listing.id}/relist")).status_code == 200


async def test_relist_refreshes_the_expiry(client, db):
    """A relisted item shouldn't inherit an expiry window that started
    months before it came back."""
    from datetime import UTC, datetime, timedelta

    seller = await make_user(db)
    stale = datetime.now(UTC) - timedelta(days=1)
    listing = await make_listing(db, seller, status=ListingStatus.sold, expires_at=stale)
    await login(client, seller)

    res = await client.post(f"/listings/{listing.id}/relist")
    new_expiry = datetime.fromisoformat(res.json()["expires_at"])
    assert new_expiry > datetime.now(UTC)


async def test_relist_refused_from_active_or_out_of_stock(client, db):
    seller = await make_user(db)
    active = await make_listing(db, seller, status=ListingStatus.active)
    out_of_stock = await make_listing(db, seller, status=ListingStatus.out_of_stock)
    await login(client, seller)
    assert (await client.post(f"/listings/{active.id}/relist")).status_code == 400
    assert (await client.post(f"/listings/{out_of_stock.id}/relist")).status_code == 400


# --- pause / reactivate --------------------------------------------------


async def test_pause_and_relist_round_trip(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.active)
    await login(client, seller)

    res = await client.post(f"/listings/{listing.id}/pause")
    assert res.status_code == 200
    assert res.json()["status"] == "paused"

    res = await client.post(f"/listings/{listing.id}/relist")
    assert res.json()["status"] == "active"


async def test_pause_refused_unless_active(client, db):
    seller = await make_user(db)
    sold = await make_listing(db, seller, status=ListingStatus.sold)
    await login(client, seller)
    assert (await client.post(f"/listings/{sold.id}/pause")).status_code == 400


async def test_a_paused_listing_is_not_publicly_browsable(client, db):
    """The whole point: browse_listings' existing status == active filter
    excludes it for free, with no new WHERE clause anywhere."""
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.active)
    await login(client, seller)
    await client.post(f"/listings/{listing.id}/pause")

    res = await client.get("/listings")
    assert listing.id not in [item["id"] for item in res.json()["items"]]
    # But its owner can still reach and manage it directly.
    assert (await client.get("/listings/mine")).status_code == 200


# --- manual reorder -------------------------------------------------------


async def test_reorder_a_shops_listings(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    a = await make_listing(db, seller, title="A", shop_id=shop.id)
    b = await make_listing(db, seller, title="B", shop_id=shop.id)
    c = await make_listing(db, seller, title="C", shop_id=shop.id)
    await login(client, seller)

    res = await client.post(
        "/listings/reorder",
        json={"shop_id": str(shop.id), "listing_ids": [str(c.id), str(a.id), str(b.id)]},
    )
    assert res.status_code == 200
    assert [item["title"] for item in res.json()] == ["C", "A", "B"]


async def test_reorder_is_reflected_in_the_shops_own_listing_view(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    a = await make_listing(db, seller, title="A", shop_id=shop.id)
    b = await make_listing(db, seller, title="B", shop_id=shop.id)
    await login(client, seller)

    await client.post(
        "/listings/reorder", json={"shop_id": str(shop.id), "listing_ids": [str(b.id), str(a.id)]}
    )
    res = await client.get(f"/listings/mine?shop_id={shop.id}")
    assert [item["title"] for item in res.json()] == ["B", "A"]


async def test_a_partial_reorder_is_refused(client, db):
    """A partial list leaves the omitted listings at stale positions and
    produces duplicate sort_orders — the same reasoning image reorder uses."""
    seller = await make_user(db)
    shop = await _shop(db, seller)
    a = await make_listing(db, seller, shop_id=shop.id)
    await make_listing(db, seller, shop_id=shop.id)
    await login(client, seller)

    res = await client.post(
        "/listings/reorder", json={"shop_id": str(shop.id), "listing_ids": [str(a.id)]}
    )
    assert res.status_code == 400


async def test_cannot_reorder_a_shop_you_dont_own(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    listing = await make_listing(db, owner, shop_id=shop.id)
    other = await make_user(db)
    await login(client, other)

    res = await client.post(
        "/listings/reorder", json={"shop_id": str(shop.id), "listing_ids": [str(listing.id)]}
    )
    assert res.status_code == 403


async def test_new_shop_listings_append_to_the_end(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await make_listing(db, seller, title="Existing", shop_id=shop.id)
    await login(client, seller)

    res = await client.post(
        "/listings",
        json={
            "title": "New arrival",
            "description": "A description long enough to be realistic.",
            "price": 500,
            "price_type": "fixed",
            "fulfillment_type": "pickup",
            "pickup_address": "Room 1",
            "category_id": await _category_id(db),
            "shop_id": str(shop.id),
            "tags": [],
        },
    )
    assert res.status_code == 201
    listings = (await client.get(f"/listings/mine?shop_id={shop.id}")).json()
    assert listings[-1]["title"] == "New arrival"


# --- quantity is really gone ---------------------------------------------


async def test_quantity_is_not_in_the_response_and_no_longer_drives_anything(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await login(client, seller)

    res = await client.post(
        "/listings",
        json={
            "title": "No stock field",
            "description": "A description long enough to be realistic.",
            "price": 500,
            "price_type": "fixed",
            "fulfillment_type": "pickup",
            "pickup_address": "Room 1",
            "category_id": await _category_id(db),
            "shop_id": str(shop.id),
            # Sent anyway, to prove a stray client sending it changes nothing.
            "quantity": 0,
            "tags": [],
        },
    )
    assert res.status_code == 201
    assert "quantity" not in res.json()
    assert res.json()["status"] == "active"


# --- restock requests ------------------------------------------------------


@pytest.fixture
async def out_of_stock_shop_listing(db):
    seller = await make_user(db, email="restock-seller@juniv.edu")
    shop = await _shop(db, seller, "Restock Shop")
    listing = await make_listing(
        db, seller, title="Wanted item", shop_id=shop.id, status=ListingStatus.out_of_stock
    )
    return seller, shop, listing


async def test_request_a_restock(client, db, out_of_stock_shop_listing):
    _seller, _shop, listing = out_of_stock_shop_listing
    buyer = await make_user(db)
    await login(client, buyer)

    res = await client.post(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 200
    assert res.json()["has_pending_restock_request"] is True

    count = (
        await db.execute(select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id))
    ).scalars().all()
    assert len(count) == 1


async def test_requesting_twice_does_not_duplicate(client, db, out_of_stock_shop_listing):
    _seller, _shop, listing = out_of_stock_shop_listing
    buyer = await make_user(db)
    await login(client, buyer)

    await client.post(f"/listings/{listing.id}/restock-request")
    await client.post(f"/listings/{listing.id}/restock-request")

    rows = (
        await db.execute(select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id))
    ).scalars().all()
    assert len(rows) == 1


async def test_cannot_request_your_own_listing(client, db, out_of_stock_shop_listing):
    seller, _shop, listing = out_of_stock_shop_listing
    await login(client, seller)
    res = await client.post(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 400


async def test_cannot_request_a_personal_listing(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, status=ListingStatus.out_of_stock)
    buyer = await make_user(db)
    await login(client, buyer)
    res = await client.post(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 400


async def test_cannot_request_a_listing_thats_not_out_of_stock(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id, status=ListingStatus.active)
    buyer = await make_user(db)
    await login(client, buyer)
    res = await client.post(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 400


async def test_withdraw_a_pending_request(client, db, out_of_stock_shop_listing):
    _seller, _shop, listing = out_of_stock_shop_listing
    buyer = await make_user(db)
    await login(client, buyer)
    await client.post(f"/listings/{listing.id}/restock-request")

    res = await client.delete(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 204

    detail = await client.get(f"/listings/{listing.id}")
    assert detail.json()["has_pending_restock_request"] is False


async def test_anonymous_visitor_sees_null_not_false(client, db, out_of_stock_shop_listing):
    """None, not False, so the button can prompt a login rather than render
    a misleading 'not requested' state — same reasoning as is_following."""
    _seller, _shop, listing = out_of_stock_shop_listing
    res = await client.get(f"/listings/{listing.id}")
    assert res.json()["has_pending_restock_request"] is None


async def test_mark_available_notifies_every_pending_requester(client, db, out_of_stock_shop_listing):
    seller, _shop, listing = out_of_stock_shop_listing
    buyer_a = await make_user(db)
    buyer_b = await make_user(db)

    await login(client, buyer_a)
    await client.post(f"/listings/{listing.id}/restock-request")
    await login(client, buyer_b)
    await client.post(f"/listings/{listing.id}/restock-request")

    await login(client, seller)
    res = await client.post(f"/listings/{listing.id}/mark-available")
    assert res.status_code == 200

    requests = (
        await db.execute(select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id))
    ).scalars().all()
    assert len(requests) == 2
    assert all(r.fulfilled_at is not None for r in requests)

    from app.models.notification import Notification, NotificationType

    notifs = (
        await db.execute(
            select(Notification).where(Notification.type == NotificationType.restock_available)
        )
    ).scalars().all()
    assert {n.user_id for n in notifs} == {buyer_a.id, buyer_b.id}


async def test_a_fulfilled_request_does_not_block_a_new_one_next_cycle(
    client, db, out_of_stock_shop_listing
):
    """The partial-unique constraint's whole reason to exist: a flat unique
    constraint would have permanently blocked a second request forever."""
    seller, _shop, listing = out_of_stock_shop_listing
    buyer = await make_user(db)

    await login(client, buyer)
    await client.post(f"/listings/{listing.id}/restock-request")

    await login(client, seller)
    await client.post(f"/listings/{listing.id}/mark-available")
    await client.post(f"/listings/{listing.id}/mark-out-of-stock")

    await login(client, buyer)
    res = await client.post(f"/listings/{listing.id}/restock-request")
    assert res.status_code == 200

    rows = (
        await db.execute(select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id))
    ).scalars().all()
    assert len(rows) == 2
    assert sum(1 for r in rows if r.fulfilled_at is None) == 1


async def test_relist_does_not_fulfil_restock_requests(client, db):
    """relist() resolves `paused`, not `out_of_stock` — a paused listing was
    never publicly visible for a buyer to have requested against. The only
    route to "paused with a pending request" is direct data manipulation
    (the API itself can't reach that combination, since pausing requires
    `active` and requesting requires `out_of_stock`), so this reaches past
    the API on setup to prove relist's own code path, not just what the
    ordinary flow happens to exercise."""
    seller = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id, status=ListingStatus.paused)
    buyer = await make_user(db)
    db.add(ListingRestockRequest(listing_id=listing.id, buyer_id=buyer.id))
    await db.flush()

    await login(client, seller)
    res = await client.post(f"/listings/{listing.id}/relist")
    assert res.status_code == 200

    row = (
        await db.execute(
            select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id)
        )
    ).scalar_one()
    assert row.fulfilled_at is None

    from app.models.notification import Notification

    assert (
        await db.execute(select(Notification).where(Notification.user_id == buyer.id))
    ).scalar_one_or_none() is None


async def test_deleting_a_listing_cascades_its_restock_requests(client, db, out_of_stock_shop_listing):
    seller, _shop, listing = out_of_stock_shop_listing
    buyer = await make_user(db)
    await login(client, buyer)
    await client.post(f"/listings/{listing.id}/restock-request")

    await login(client, seller)
    await client.delete(f"/listings/{listing.id}")

    rows = (
        await db.execute(select(ListingRestockRequest).where(ListingRestockRequest.listing_id == listing.id))
    ).scalars().all()
    assert rows == []


async def test_restock_request_count_on_the_sellers_own_listing_view(
    client, db, out_of_stock_shop_listing
):
    """A count, not a name list — matching the shop-follower-count precedent."""
    seller, shop, listing = out_of_stock_shop_listing
    for _ in range(3):
        buyer = await make_user(db)
        await login(client, buyer)
        await client.post(f"/listings/{listing.id}/restock-request")

    await login(client, seller)
    res = await client.get(f"/listings/mine?shop_id={shop.id}")
    row = next(item for item in res.json() if item["id"] == str(listing.id))
    assert row["restock_request_count"] == 3
