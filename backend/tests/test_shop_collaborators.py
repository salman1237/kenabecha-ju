"""Shop collaborators: an owner invites another registered user, by exact
email, to co-manage a shop -- edit it, add/edit its listings, post for it --
without becoming a second owner. Deleting the shop and managing who else
has access stay owner-only.
"""

import uuid

from app.core.security import hash_password
from app.models.shop import Shop
from app.models.shop_collaborator import ShopCollaborator, ShopCollaboratorStatus
from app.models.user import User
from tests.conftest import TEST_PASSWORD, login, make_user


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    shop = Shop(owner_id=owner.id, shop_name=name, slug=name.lower().replace(" ", "-"))
    db.add(shop)
    await db.flush()
    return shop


async def _unverified_user(db) -> User:
    """A Google-lite buyer: signed up, but never completed JU verification
    (no student_id/hall/department/session/batch), so profile_complete is
    False -- must not be inviteable as a shop collaborator."""
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"unverified-{suffix}@example.com",
        hashed_password=hash_password(TEST_PASSWORD),
        full_name=f"Unverified {suffix}",
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _accept_collaborator(db, shop, user) -> ShopCollaborator:
    """Skips the HTTP invite/accept round trip for tests that only care
    about what an *already-accepted* collaborator can do."""
    row = ShopCollaborator(
        shop_id=shop.id, user_id=user.id, invited_by=shop.owner_id, status=ShopCollaboratorStatus.accepted
    )
    db.add(row)
    await db.flush()
    return row


async def test_owner_can_invite_by_exact_email(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["user_email"] == invitee.email


async def test_non_owner_cannot_invite(client, db):
    owner = await make_user(db)
    stranger = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, stranger)
    res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})

    assert res.status_code == 403


async def test_cannot_invite_the_shop_owner(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": owner.email})

    assert res.status_code == 400


async def test_inviting_an_unknown_email_404s(client, db):
    owner = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": "nobody@juniv.edu"})

    assert res.status_code == 404


async def test_cannot_double_invite_while_pending(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})
    res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})

    assert res.status_code == 400


async def test_invited_user_sees_the_pending_invite(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner, name="Deshlet")

    await login(client, owner)
    await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})

    await login(client, invitee)
    res = await client.get("/shop-invites")

    assert res.status_code == 200
    invites = res.json()
    assert len(invites) == 1
    assert invites[0]["shop_name"] == "Deshlet"
    assert invites[0]["invited_by_name"] == owner.full_name


async def test_a_different_user_cannot_respond_to_someone_elses_invite(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    stranger = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    invite_res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})
    invite_id = invite_res.json()["id"]

    await login(client, stranger)
    res = await client.post(f"/shop-invites/{invite_id}/respond", json={"accept": True})

    assert res.status_code == 404


async def test_accepting_grants_access_to_manage_listings(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    invite_res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})
    invite_id = invite_res.json()["id"]

    await login(client, invitee)
    respond_res = await client.post(f"/shop-invites/{invite_id}/respond", json={"accept": True})
    assert respond_res.status_code == 204

    create_res = await client.post(
        "/listings",
        json={
            "title": "Collaborator-added item",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )
    assert create_res.status_code == 201, create_res.text
    assert create_res.json()["shop"]["id"] == str(shop.id)


async def test_declining_grants_no_access(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    invite_res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})
    invite_id = invite_res.json()["id"]

    await login(client, invitee)
    respond_res = await client.post(f"/shop-invites/{invite_id}/respond", json={"accept": False})
    assert respond_res.status_code == 204

    create_res = await client.post(
        "/listings",
        json={
            "title": "Should be refused",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )
    assert create_res.status_code == 403


async def test_reinviting_after_decline_resets_to_pending_not_a_duplicate(client, db):
    owner = await make_user(db)
    invitee = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, owner)
    first = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})
    first_id = first.json()["id"]

    await login(client, invitee)
    await client.post(f"/shop-invites/{first_id}/respond", json={"accept": False})

    await login(client, owner)
    second = await client.post(f"/shops/{shop.id}/collaborators", json={"email": invitee.email})

    assert second.status_code == 201
    assert second.json()["id"] == first_id
    assert second.json()["status"] == "pending"


async def test_owner_can_manage_a_listing_a_collaborator_created(client, db):
    """The whole point of sharing shop management: the owner isn't locked
    out of inventory someone else on the team added."""
    owner = await make_user(db)
    collaborator = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)

    await login(client, collaborator)
    create_res = await client.post(
        "/listings",
        json={
            "title": "Added by collaborator",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )
    listing_id = create_res.json()["id"]

    await login(client, owner)
    edit_res = await client.patch(f"/listings/{listing_id}", json={"title": "Edited by owner"})

    assert edit_res.status_code == 200, edit_res.text
    assert edit_res.json()["title"] == "Edited by owner"


async def test_an_unverified_employee_can_be_invited_and_list_for_the_shop(client, db):
    """A shop owner should be able to bring on a non-JU employee to run the
    shop day to day -- the shop's legitimacy rests on the verified owner,
    not on every individual who helps manage it."""
    owner = await make_user(db)
    employee = await _unverified_user(db)
    assert not employee.profile_complete
    shop = await _shop(db, owner)

    await login(client, owner)
    invite_res = await client.post(f"/shops/{shop.id}/collaborators", json={"email": employee.email})
    assert invite_res.status_code == 201, invite_res.text
    invite_id = invite_res.json()["id"]

    await login(client, employee)
    respond_res = await client.post(f"/shop-invites/{invite_id}/respond", json={"accept": True})
    assert respond_res.status_code == 204

    listing_res = await client.post(
        "/listings",
        json={
            "title": "Added by an unverified employee",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )
    assert listing_res.status_code == 201, listing_res.text

    post_res = await client.post(
        "/posts",
        json={"shop_id": str(shop.id), "title": "Fresh stock today", "description_html": "<p>Come get it</p>"},
    )
    assert post_res.status_code == 201, post_res.text


async def test_an_unverified_employee_still_cannot_list_personally(client, db):
    """Shop access is scoped to the shop -- it isn't a backdoor around the
    JU-verification requirement for that employee's own personal listings."""
    owner = await make_user(db)
    employee = await _unverified_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, employee)

    await login(client, employee)
    res = await client.post(
        "/listings",
        json={
            "title": "Personal item, not the shop's",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "condition": "new",
            "fulfillment_type": "pickup",
            "pickup_address": "Dorm room",
        },
    )

    assert res.status_code == 403


async def test_collaborator_can_edit_shop_but_not_delete_it(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)

    await login(client, collaborator)
    edit_res = await client.patch(f"/shops/{shop.id}", json={"description": "Updated by a collaborator"})
    assert edit_res.status_code == 200, edit_res.text

    delete_res = await client.delete(f"/shops/{shop.id}")
    assert delete_res.status_code == 403


async def test_collaborator_cannot_remove_other_collaborators(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    other = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)
    other_row = await _accept_collaborator(db, shop, other)

    await login(client, collaborator)
    res = await client.delete(f"/shops/{shop.id}/collaborators/{other_row.id}")

    assert res.status_code == 403


async def test_owner_can_remove_a_collaborator_and_access_is_revoked(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    shop = await _shop(db, owner)
    row = await _accept_collaborator(db, shop, collaborator)

    await login(client, owner)
    remove_res = await client.delete(f"/shops/{shop.id}/collaborators/{row.id}")
    assert remove_res.status_code == 204

    await login(client, collaborator)
    create_res = await client.post(
        "/listings",
        json={
            "title": "Should be refused after removal",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )
    assert create_res.status_code == 403


async def test_collaborator_can_create_a_shop_post(client, db):
    owner = await make_user(db)
    collaborator = await make_user(db)
    shop = await _shop(db, owner)
    await _accept_collaborator(db, shop, collaborator)

    await login(client, collaborator)
    res = await client.post(
        "/posts",
        json={"shop_id": str(shop.id), "title": "Fresh stock today", "description_html": "<p>Come get it</p>"},
    )

    assert res.status_code == 201, res.text


async def test_unrelated_user_has_no_access_at_all(client, db):
    owner = await make_user(db)
    stranger = await make_user(db)
    shop = await _shop(db, owner)

    await login(client, stranger)
    res = await client.post(
        "/listings",
        json={
            "title": "Should be refused",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "shop_id": str(shop.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Shop counter",
        },
    )

    assert res.status_code == 403
