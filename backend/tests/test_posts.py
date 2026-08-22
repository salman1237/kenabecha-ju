"""Phase 52: shop posts — a title + rich-text description a shop can link to
its own listings, submit for moderation, and re-post as often as it wants to
draw attention back to something already for sale.

Three properties matter beyond the ordinary CRUD: stored HTML is genuinely
sanitized (this is the app's first user-generated-HTML-at-rest surface), an
edit to an already-moderated post silently resubmits it to pending, and the
public feed puts followed shops first.
"""

import uuid

from sqlalchemy import select

from app.models.audit import AuditAction, AuditLog
from app.models.follow import ShopFollow
from app.models.notification import Notification, NotificationType
from app.models.post import PostStatus, ShopPost
from app.models.shop import Shop
from app.services.sanitize import sanitize_post_html
from tests.conftest import login, make_listing, make_user


async def _shop(db, owner, name: str = "Test Shop") -> Shop:
    suffix = uuid.uuid4().hex[:8]
    shop = Shop(owner_id=owner.id, shop_name=f"{name} {suffix}", slug=f"{name.lower().replace(' ', '-')}-{suffix}")
    db.add(shop)
    await db.flush()
    return shop


async def _create_post(client, shop, *, title="New arrival", listing_ids=None, description="<p>Hello</p>"):
    return await client.post(
        "/posts",
        json={
            "shop_id": str(shop.id),
            "title": title,
            "description_html": description,
            "listing_ids": [str(i) for i in (listing_ids or [])],
        },
    )


# --- creation -----------------------------------------------------------


async def test_create_post_with_linked_listing(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id)
    await login(client, seller)

    res = await _create_post(client, shop, listing_ids=[listing.id])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"
    assert body["shop"]["id"] == str(shop.id)
    assert [l["id"] for l in body["listings"]] == [str(listing.id)]


# --- sanitization (required) ---------------------------------------------


def test_sanitize_post_html_strips_scripts_and_disallowed_css():
    raw = (
        '<p onclick="alert(1)">Hi <script>alert(1)</script>'
        '<span style="color: red; background-color: url(evil.png)">colored</span></p>'
    )
    cleaned = sanitize_post_html(raw)
    assert "<script" not in cleaned
    assert "onclick" not in cleaned
    assert "url(" not in cleaned
    assert "color: red" in cleaned


async def test_create_post_sanitizes_description_end_to_end(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await login(client, seller)

    payload = '<p>Safe text<script>alert(document.cookie)</script></p><span style="color: blue; background: url(evil)">x</span>'
    res = await _create_post(client, shop, description=payload)
    assert res.status_code == 201
    stored = res.json()["description_html"]
    assert "<script" not in stored
    assert "url(" not in stored
    assert "color: blue" in stored


# --- resubmit-to-pending ---------------------------------------------------


async def test_editing_a_published_post_resubmits_it_to_pending(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    await login(client, moderator)
    approve = await client.post(f"/admin/posts/{post_id}/approve")
    assert approve.json()["status"] == "published"

    await login(client, seller)
    res = await client.patch(f"/posts/{post_id}", json={"title": "Updated title"})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


async def test_editing_a_rejected_post_resubmits_it_and_clears_reason(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    await login(client, moderator)
    await client.post(f"/admin/posts/{post_id}/reject", json={"reason": "Needs a real photo"})

    await login(client, seller)
    res = await client.patch(f"/posts/{post_id}", json={"title": "Updated title"})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"
    assert res.json()["rejection_reason"] is None


async def test_editing_a_pending_post_stays_pending(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    res = await client.patch(f"/posts/{post_id}", json={"title": "Still pending"})
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


# --- listing-ownership validation ------------------------------------------


async def test_linking_a_listing_from_another_shop_is_forbidden(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    other_seller = await make_user(db)
    other_shop = await _shop(db, other_seller, name="Other Shop")
    foreign_listing = await make_listing(db, other_seller, shop_id=other_shop.id)

    await login(client, seller)
    res = await _create_post(client, shop, listing_ids=[foreign_listing.id])
    assert res.status_code == 403


async def test_the_same_listing_can_be_linked_from_two_separate_posts(client, db):
    """The whole point of the feature: post about the same product again."""
    seller = await make_user(db)
    shop = await _shop(db, seller)
    listing = await make_listing(db, seller, shop_id=shop.id)
    await login(client, seller)

    first = await _create_post(client, shop, title="First post", listing_ids=[listing.id])
    second = await _create_post(client, shop, title="Second post", listing_ids=[listing.id])
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


# --- follow-based feed order ------------------------------------------------


async def test_feed_ranks_followed_shops_first(client, db):
    viewer = await make_user(db)
    seller_a = await make_user(db)
    seller_b = await make_user(db)
    shop_a = await _shop(db, seller_a, name="Shop A")
    shop_b = await _shop(db, seller_b, name="Shop B")

    db.add(ShopFollow(user_id=viewer.id, shop_id=shop_b.id))
    await db.flush()

    moderator = await make_user(db, role="moderator")

    await login(client, seller_a)
    post_a = (await _create_post(client, shop_a, title="From A")).json()["id"]

    await login(client, seller_b)
    post_b = (await _create_post(client, shop_b, title="From B")).json()["id"]

    await login(client, moderator)
    await client.post(f"/admin/posts/{post_a}/approve")
    await client.post(f"/admin/posts/{post_b}/approve")

    await login(client, viewer)
    res = await client.get("/posts/feed")
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()["items"]]
    assert ids.index(post_b) < ids.index(post_a)


async def test_anonymous_feed_is_newest_first_with_no_error(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    await login(client, moderator)
    await client.post(f"/admin/posts/{post_id}/approve")

    anon = await client.get("/posts/feed")
    assert anon.status_code == 200
    assert any(p["id"] == post_id for p in anon.json()["items"])


# --- notification fan-out ---------------------------------------------------


async def test_approving_a_post_notifies_only_its_followers(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    follower_a = await make_user(db)
    follower_b = await make_user(db)
    non_follower = await make_user(db)
    db.add(ShopFollow(user_id=follower_a.id, shop_id=shop.id))
    db.add(ShopFollow(user_id=follower_b.id, shop_id=shop.id))
    await db.flush()

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    await client.post(f"/admin/posts/{post_id}/approve")

    notifs = (
        await db.execute(
            select(Notification).where(
                Notification.type == NotificationType.shop_new_post,
                Notification.related_post_id == uuid.UUID(post_id),
            )
        )
    ).scalars().all()
    assert {n.user_id for n in notifs} == {follower_a.id, follower_b.id}
    assert non_follower.id not in {n.user_id for n in notifs}


async def test_rejecting_a_post_notifies_the_owner(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    moderator = await make_user(db, role="moderator")
    await login(client, moderator)
    await client.post(f"/admin/posts/{post_id}/reject", json={"reason": "Blurry photo"})

    notif = (
        await db.execute(
            select(Notification).where(
                Notification.user_id == seller.id, Notification.type == NotificationType.post_rejected
            )
        )
    ).scalar_one()
    assert notif.related_post_id == uuid.UUID(post_id)


# --- moderation + audit trail ------------------------------------------------


async def test_approve_reject_unpublish_delete_transitions_and_audit(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    await login(client, moderator)

    res = await client.post(f"/admin/posts/{post_id}/approve")
    assert res.json()["status"] == "published"
    entry = (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.POST_APPROVED))
    ).scalars().first()
    assert entry is not None and entry.target_id == uuid.UUID(post_id)

    res = await client.post(f"/admin/posts/{post_id}/unpublish")
    assert res.json()["status"] == "pending"
    assert (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.POST_UNPUBLISHED))
    ).scalars().first() is not None

    res = await client.post(f"/admin/posts/{post_id}/reject", json={"reason": "Not today"})
    assert res.json()["status"] == "rejected"
    assert res.json()["rejection_reason"] == "Not today"
    assert (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.POST_REJECTED))
    ).scalars().first() is not None

    res = await client.delete(f"/admin/posts/{post_id}")
    assert res.status_code == 200
    assert (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.POST_DELETED))
    ).scalars().first() is not None
    stored = await db.get(ShopPost, uuid.UUID(post_id))
    assert stored.deleted_at is not None


# --- bulk moderation ----------------------------------------------------


async def test_bulk_approve_reports_per_item_success_and_failure(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]
    missing_id = str(uuid.uuid4())

    await login(client, moderator)
    res = await client.post("/admin/posts/bulk-approve", json={"ids": [post_id, missing_id]})
    assert res.status_code == 200
    body = res.json()
    assert body["succeeded"] == [post_id]
    assert missing_id in {f["id"] for f in body["failed"]}


async def test_bulk_reject_applies_the_same_reason_to_every_post(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")

    await login(client, seller)
    id_a = (await _create_post(client, shop, title="Post A")).json()["id"]
    id_b = (await _create_post(client, shop, title="Post B")).json()["id"]

    await login(client, moderator)
    res = await client.post("/admin/posts/bulk-reject", json={"ids": [id_a, id_b], "reason": "Bulk reason"})
    assert res.status_code == 200
    assert set(res.json()["succeeded"]) == {id_a, id_b}

    for pid in (id_a, id_b):
        post = await db.get(ShopPost, uuid.UUID(pid))
        assert post.status == PostStatus.rejected
        assert post.rejection_reason == "Bulk reason"


# --- visibility -----------------------------------------------------------


async def test_pending_post_is_invisible_to_a_random_user_but_visible_to_owner_and_staff(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    stranger = await make_user(db)
    staff = await make_user(db, role="moderator")

    await login(client, seller)
    slug = (await _create_post(client, shop)).json()["slug"]

    await login(client, stranger)
    assert (await client.get(f"/posts/{slug}")).status_code == 404

    client.cookies.clear()
    assert (await client.get(f"/posts/{slug}")).status_code == 404

    await login(client, seller)
    assert (await client.get(f"/posts/{slug}")).status_code == 200

    await login(client, staff)
    assert (await client.get(f"/posts/{slug}")).status_code == 200


# --- shop storefront tab ---------------------------------------------------


async def test_shop_posts_endpoint_shows_published_only_to_strangers_but_all_to_the_owner(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    moderator = await make_user(db, role="moderator")
    stranger = await make_user(db)

    await login(client, seller)
    published_id = (await _create_post(client, shop, title="Published one")).json()["id"]
    pending_id = (await _create_post(client, shop, title="Pending one")).json()["id"]

    await login(client, moderator)
    await client.post(f"/admin/posts/{published_id}/approve")

    await login(client, stranger)
    res = await client.get(f"/posts/shop/{shop.id}")
    assert res.status_code == 200
    ids = {p["id"] for p in res.json()}
    assert ids == {published_id}

    await login(client, seller)
    res = await client.get(f"/posts/shop/{shop.id}")
    ids = {p["id"] for p in res.json()}
    assert ids == {published_id, pending_id}


async def test_only_the_owner_can_edit_or_delete_a_post(client, db):
    seller = await make_user(db)
    shop = await _shop(db, seller)
    stranger = await make_user(db)

    await login(client, seller)
    post_id = (await _create_post(client, shop)).json()["id"]

    await login(client, stranger)
    assert (await client.patch(f"/posts/{post_id}", json={"title": "Hijacked"})).status_code == 403
    assert (await client.delete(f"/posts/{post_id}")).status_code == 403
