"""Phase 59: shop stats surfaces a buyer's rateable purchase from that shop,
so the Reviews tab has something to point at without the buyer already
knowing which listing to go back to.
"""

from app.models.conversation import Conversation
from app.models.listing import ListingStatus
from app.models.rating import Rating, RatingTargetType
from app.models.shop import Shop
from tests.conftest import login, make_listing, make_user


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


async def _conversation(db, listing, buyer, seller, shop=None) -> Conversation:
    convo = Conversation(
        listing_id=listing.id, buyer_id=buyer.id, seller_id=seller.id, shop_id=shop.id if shop else None
    )
    db.add(convo)
    await db.flush()
    return convo


async def test_rateable_listing_is_surfaced_for_a_messaged_sold_purchase(client, db):
    seller = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(
        db, seller, title="Sold thing", shop_id=shop.id, status=ListingStatus.sold
    )
    await _conversation(db, listing, buyer, seller, shop)

    await login(client, buyer)
    res = await client.get(f"/shops/{shop.slug}/stats")

    assert res.status_code == 200
    body = res.json()["rateable_listing"]
    assert body == {"id": str(listing.id), "title": "Sold thing"}


async def test_rateable_listing_is_null_once_rated(client, db):
    seller = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id, status=ListingStatus.sold)
    await _conversation(db, listing, buyer, seller, shop)
    db.add(
        Rating(
            listing_id=listing.id,
            rater_id=buyer.id,
            target_type=RatingTargetType.shop,
            target_shop_id=shop.id,
            stars=5,
        )
    )
    await db.flush()

    await login(client, buyer)
    res = await client.get(f"/shops/{shop.slug}/stats")

    assert res.json()["rateable_listing"] is None


async def test_rateable_listing_is_null_without_a_sold_purchase(client, db):
    seller = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id, status=ListingStatus.active)
    await _conversation(db, listing, buyer, seller, shop)

    await login(client, buyer)
    res = await client.get(f"/shops/{shop.slug}/stats")

    assert res.json()["rateable_listing"] is None


async def test_rateable_listing_is_null_for_anonymous_viewers(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await make_listing(db, seller, shop_id=shop.id, status=ListingStatus.sold)

    res = await client.get(f"/shops/{shop.slug}/stats")

    assert res.json()["rateable_listing"] is None
