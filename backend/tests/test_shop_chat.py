"""A buyer's message about a shop listing must reach the whole shop team
(owner + accepted collaborators), not just whichever one person happens to
be the listing's literal creator or Conversation.seller_id.
"""

from sqlalchemy import select

from app.models.notification import Notification, NotificationType
from app.models.shop import Shop
from app.models.shop_collaborator import ShopCollaborator, ShopCollaboratorStatus
from tests.conftest import login, make_listing, make_user


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


async def _accept_collaborator(db, shop, user) -> ShopCollaborator:
    row = ShopCollaborator(
        shop_id=shop.id, user_id=user.id, invited_by=shop.owner_id, status=ShopCollaboratorStatus.accepted
    )
    db.add(row)
    await db.flush()
    return row


async def test_contacting_a_collaborator_listing_routes_to_the_owner(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)
    listing = await make_listing(db, collaborator, shop_id=shop.id)

    await login(client, buyer)
    res = await client.post(f"/listings/{listing.id}/contact")

    assert res.status_code == 201, res.text
    body = res.json()
    # The counterparty shown to the buyer is the shop's identity, and the
    # conversation is routed to the owner -- not the collaborator who
    # happened to create this one listing.
    assert body["counterparty"]["id"] == str(owner.id)


async def test_owner_and_collaborator_can_both_open_the_conversation(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)
    listing = await make_listing(db, collaborator, shop_id=shop.id)

    await login(client, buyer)
    conv = (await client.post(f"/listings/{listing.id}/contact")).json()

    await login(client, collaborator)
    res = await client.get(f"/conversations/{conv['id']}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_seller"] is True
    assert body["counterparty"]["id"] == str(buyer.id)


async def test_a_stranger_cannot_open_the_conversation(client, db):
    owner = await make_user(db)
    buyer = await make_user(db)
    stranger = await make_user(db)
    shop = await _shop(db, owner)
    listing = await make_listing(db, owner, shop_id=shop.id)

    await login(client, buyer)
    conv = (await client.post(f"/listings/{listing.id}/contact")).json()

    await login(client, stranger)
    res = await client.get(f"/conversations/{conv['id']}")
    assert res.status_code == 403


async def test_buyer_message_notifies_the_whole_shop_team(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)
    listing = await make_listing(db, collaborator, shop_id=shop.id)

    await login(client, buyer)
    conv = (await client.post(f"/listings/{listing.id}/contact")).json()
    res = await client.post(f"/conversations/{conv['id']}/messages", json={"content": "Is this still available?"})
    assert res.status_code == 201, res.text

    result = await db.execute(
        select(Notification.user_id).where(Notification.type == NotificationType.new_message)
    )
    notified = {row[0] for row in result.all()}
    assert owner.id in notified
    assert collaborator.id in notified


async def test_personal_listing_still_notifies_only_the_seller(client, db):
    seller = await make_user(db)
    buyer = await make_user(db)
    listing = await make_listing(db, seller)

    await login(client, buyer)
    conv = (await client.post(f"/listings/{listing.id}/contact")).json()
    await client.post(f"/conversations/{conv['id']}/messages", json={"content": "Still available?"})

    result = await db.execute(
        select(Notification.user_id).where(Notification.type == NotificationType.new_message)
    )
    notified = {row[0] for row in result.all()}
    assert notified == {seller.id}


async def test_collaborator_reading_the_thread_marks_it_read_for_the_team(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    buyer = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)
    listing = await make_listing(db, collaborator, shop_id=shop.id)

    await login(client, buyer)
    conv = (await client.post(f"/listings/{listing.id}/contact")).json()
    await client.post(f"/conversations/{conv['id']}/messages", json={"content": "Hello?"})

    await login(client, owner)
    owner_view = (await client.get(f"/conversations/{conv['id']}")).json()
    assert owner_view["unread_count"] == 1

    await login(client, collaborator)
    collaborator_view = (await client.get(f"/conversations/{conv['id']}")).json()
    assert collaborator_view["unread_count"] == 1

    res = await client.post(f"/conversations/{conv['id']}/read")
    assert res.status_code == 204

    await login(client, owner)
    owner_view_after = (await client.get(f"/conversations/{conv['id']}")).json()
    assert owner_view_after["unread_count"] == 0
