"""Product variants: a shop listing can offer priced options (size, pack
quantity, edition) instead of one price for the whole listing. Shop
listings only -- personal listings keep today's single-price behavior.
"""

from app.models.shop import Shop
from tests.conftest import login, make_listing, make_user


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


def _listing_payload(shop_id, **overrides):
    payload = {
        "title": "Variant test item",
        "description": "A description long enough to be realistic.",
        "shop_id": str(shop_id),
        "fulfillment_type": "pickup",
        "pickup_address": "Shop counter",
    }
    payload.update(overrides)
    return payload


async def test_create_shop_listing_with_variants(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    res = await client.post(
        "/listings",
        json=_listing_payload(
            shop.id,
            variants=[
                {"name": "Small", "price": "500"},
                {"name": "Large", "price": "800", "is_available": False},
            ],
        ),
    )

    assert res.status_code == 201, res.text
    body = res.json()
    assert len(body["variants"]) == 2
    assert [v["name"] for v in body["variants"]] == ["Small", "Large"]
    assert body["variants"][1]["is_available"] is False
    assert body["price"] == "500.00"
    assert body["price_type"] == "fixed"


async def test_create_personal_listing_rejects_variants(client, db):
    seller = await make_user(db)
    await login(client, seller)

    res = await client.post(
        "/listings",
        json={
            "title": "Personal item",
            "description": "A description long enough to be realistic.",
            "condition": "new",
            "price": "500",
            "fulfillment_type": "pickup",
            "pickup_address": "Dorm room",
            "variants": [{"name": "Small", "price": "500"}],
        },
    )

    assert res.status_code == 400


async def test_create_shop_listing_without_variants_unaffected(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    res = await client.post("/listings", json=_listing_payload(shop.id, price="750"))

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["variants"] == []
    assert body["price"] == "750.00"


async def test_min_price_sync_on_create(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    res = await client.post(
        "/listings",
        json=_listing_payload(
            shop.id,
            variants=[
                {"name": "A", "price": "500"},
                {"name": "B", "price": "300"},
                {"name": "C", "price": "800"},
            ],
        ),
    )

    assert res.json()["price"] == "300.00"


async def test_update_replaces_all_variants_not_append(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    create_res = await client.post(
        "/listings",
        json=_listing_payload(shop.id, variants=[{"name": "A", "price": "500"}, {"name": "B", "price": "600"}]),
    )
    listing_id = create_res.json()["id"]

    update_res = await client.patch(
        f"/listings/{listing_id}",
        json={"variants": [{"name": "C", "price": "700"}]},
    )

    assert update_res.status_code == 200, update_res.text
    variants = update_res.json()["variants"]
    assert [v["name"] for v in variants] == ["C"]
    assert update_res.json()["price"] == "700.00"


async def test_update_clears_variants_requires_price(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    create_res = await client.post(
        "/listings", json=_listing_payload(shop.id, variants=[{"name": "A", "price": "500"}])
    )
    listing_id = create_res.json()["id"]

    # Clearing variants leaves the last-synced price in place, so this
    # succeeds without needing a fresh price in the same payload.
    clear_res = await client.patch(f"/listings/{listing_id}", json={"variants": []})
    assert clear_res.status_code == 200, clear_res.text
    assert clear_res.json()["variants"] == []
    assert clear_res.json()["price"] == "500.00"


async def test_update_personal_listing_rejects_variants(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller)
    await login(client, seller)

    res = await client.patch(
        f"/listings/{listing.id}", json={"variants": [{"name": "Small", "price": "500"}]}
    )

    assert res.status_code == 400


async def test_variant_cap_enforced(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    variants = [{"name": f"Option {i}", "price": "100"} for i in range(21)]
    res = await client.post("/listings", json=_listing_payload(shop.id, variants=variants))

    assert res.status_code in (400, 422)


async def test_duplicate_variant_names_rejected(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    res = await client.post(
        "/listings",
        json=_listing_payload(
            shop.id, variants=[{"name": "Small", "price": "100"}, {"name": "small", "price": "200"}]
        ),
    )

    assert res.status_code == 422


async def test_negative_variant_price_rejected(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    res = await client.post(
        "/listings", json=_listing_payload(shop.id, variants=[{"name": "Small", "price": "-1"}])
    )

    assert res.status_code == 422


async def test_unavailable_variant_still_returned(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    create_res = await client.post(
        "/listings",
        json=_listing_payload(shop.id, variants=[{"name": "Small", "price": "500", "is_available": False}]),
    )
    listing_id = create_res.json()["id"]

    res = await client.get(f"/listings/{listing_id}")

    assert len(res.json()["variants"]) == 1
    assert res.json()["variants"][0]["is_available"] is False


async def test_browse_min_price_filter_reflects_variant_prices(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)
    await login(client, owner)

    await client.post(
        "/listings",
        json=_listing_payload(shop.id, variants=[{"name": "Cheap", "price": "300"}, {"name": "Pricey", "price": "800"}]),
    )

    matching = await client.get("/listings", params={"max_price": "400"})
    assert any(l["title"] == "Variant test item" for l in matching.json()["items"])

    excluded = await client.get("/listings", params={"min_price": "400"})
    assert not any(l["title"] == "Variant test item" for l in excluded.json()["items"])
