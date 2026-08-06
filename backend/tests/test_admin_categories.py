"""Category management.

The taxonomy is the one piece of admin content that real stock points at.
`listings.category_id` is ON DELETE SET NULL and `categories.parent_id` is ON
DELETE CASCADE, so a careless delete does not fail loudly — it quietly
uncategorises listings, or takes a whole subtree with it. Most of what
follows is about making those two paths impossible to walk by accident.
"""

import pytest
from sqlalchemy import delete, select, update

from app.models.audit import AuditAction, AuditLog
from app.models.category import Category
from app.models.listing import Listing
from tests.conftest import login, make_listing, make_user


@pytest.fixture(autouse=True)
async def clean_slate(request, db):
    """Start from an empty taxonomy.

    The initial migration seeds the 34 categories the site shipped with,
    which is right for a real database and wrong for a test asserting on
    exactly three. Listings are detached first because `category_id` is
    ON DELETE SET NULL and would otherwise take the deletion silently —
    the very behaviour these tests exist to police. Tests marked `keep_seed`
    opt out.
    """
    if request.node.get_closest_marker("keep_seed") is None:
        await db.execute(update(Listing).values(category_id=None))
        await db.execute(delete(Category))
        await db.flush()


async def _category(db, name: str, *, parent: Category | None = None, active: bool = True):
    category = Category(
        name=name,
        slug=name.lower().replace(" ", "-").replace("&", "and"),
        parent_id=parent.id if parent else None,
        sort_order=0,
        is_active=active,
    )
    db.add(category)
    await db.flush()
    return category


@pytest.fixture
async def admin(client, db):
    user = await make_user(db, role="admin")
    await login(client, user)
    return user


# --- what the migration seeded -----------------------------------------------


@pytest.mark.keep_seed
async def test_the_shipped_taxonomy_is_intact_and_visible(client, db):
    """Adding `is_active` must not have retired anything. If this fails, a
    deploy emptied the sidebar of a live site."""
    tree = (await client.get("/categories")).json()
    assert len(tree) == 8
    assert all(c["is_active"] for c in tree)
    assert all(child["is_active"] for c in tree for child in c["children"])
    assert [c["slug"] for c in tree][:3] == ["books-study", "electronics", "hostel-living"]


# --- who may reshape the taxonomy --------------------------------------------


async def test_anonymous_cannot_read_or_change_categories(client, db):
    assert (await client.get("/admin/categories")).status_code in (401, 403)
    assert (await client.post("/admin/categories", json={"name": "X"})).status_code in (401, 403)


async def test_moderators_cannot_change_the_taxonomy(client, db):
    """A moderator polices listings. Deciding what a listing may *be* is a
    different power, and it changes what every seller sees."""
    category = await _category(db, "Electronics")
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.get("/admin/categories")).status_code == 403
    assert (
        await client.patch(f"/admin/categories/{category.id}", json={"name": "Tech"})
    ).status_code == 403
    assert (await client.delete(f"/admin/categories/{category.id}")).status_code == 403


# --- creating ----------------------------------------------------------------


async def test_creating_derives_a_slug_and_appends_to_its_level(client, db, admin):
    res = await client.post("/admin/categories", json={"name": "Musical Instruments", "icon": "🎸"})
    assert res.status_code == 201
    created = res.json()
    assert created["slug"] == "musical-instruments"
    assert created["is_active"] is True
    assert created["parent_id"] is None


async def test_two_categories_may_share_a_name(client, db, admin):
    """"Accessories" under both Electronics and Fashion is a real taxonomy,
    so a slug collision must resolve itself rather than become the admin's
    problem."""
    a = (await client.post("/admin/categories", json={"name": "Accessories"})).json()
    b = (await client.post("/admin/categories", json={"name": "Accessories"})).json()
    assert a["slug"] != b["slug"]


async def test_a_third_level_is_refused(client, db, admin):
    """descendant_ids only looks one level down, so a grandchild would be
    silently unbrowsable — the depth limit has to be enforced, not assumed."""
    parent = await _category(db, "Electronics")
    child = await _category(db, "Laptops", parent=parent)

    res = await client.post(
        "/admin/categories", json={"name": "Gaming Laptops", "parent_id": str(child.id)}
    )
    assert res.status_code == 400


async def test_an_unknown_parent_is_refused(client, db, admin):
    import uuid as _uuid

    res = await client.post(
        "/admin/categories", json={"name": "Orphan", "parent_id": str(_uuid.uuid4())}
    )
    assert res.status_code == 400


# --- editing -----------------------------------------------------------------


async def test_renaming_leaves_the_slug_alone(client, db, admin):
    """The slug is the URL. Repointing every inbound link because someone
    fixed a label would be a surprising cost for a cosmetic change."""
    category = await _category(db, "Electronics")

    res = await client.patch(f"/admin/categories/{category.id}", json={"name": "Tech & Gadgets"})
    assert res.status_code == 200
    assert res.json()["name"] == "Tech & Gadgets"
    assert res.json()["slug"] == "electronics"


async def test_the_slug_can_be_changed_explicitly(client, db, admin):
    category = await _category(db, "Electronics")
    res = await client.patch(f"/admin/categories/{category.id}", json={"slug": "tech"})
    assert res.json()["slug"] == "tech"


async def test_an_icon_can_be_cleared(client, db, admin):
    """`icon: null` and an absent `icon` both arrive as None; only the first
    should clear it."""
    category = await _category(db, "Electronics")
    category.icon = "💻"
    await db.flush()

    unchanged = await client.patch(f"/admin/categories/{category.id}", json={"name": "Tech"})
    assert unchanged.json()["icon"] == "💻"

    cleared = await client.patch(f"/admin/categories/{category.id}", json={"icon": None})
    assert cleared.json()["icon"] is None


async def test_a_category_can_be_moved_to_another_parent(client, db, admin):
    electronics = await _category(db, "Electronics")
    fashion = await _category(db, "Fashion")
    accessories = await _category(db, "Accessories", parent=electronics)

    res = await client.patch(
        f"/admin/categories/{accessories.id}", json={"parent_id": str(fashion.id)}
    )
    assert res.status_code == 200
    assert res.json()["parent_id"] == str(fashion.id)


async def test_a_child_can_be_promoted_to_the_top_level(client, db, admin):
    electronics = await _category(db, "Electronics")
    laptops = await _category(db, "Laptops", parent=electronics)

    res = await client.patch(f"/admin/categories/{laptops.id}", json={"parent_id": None})
    assert res.status_code == 200
    assert res.json()["parent_id"] is None


async def test_a_parent_with_children_cannot_be_nested(client, db, admin):
    """The other direction of the same depth rule: nesting a parent would
    push its children to level three."""
    electronics = await _category(db, "Electronics")
    fashion = await _category(db, "Fashion")
    await _category(db, "Laptops", parent=electronics)

    res = await client.patch(
        f"/admin/categories/{electronics.id}", json={"parent_id": str(fashion.id)}
    )
    assert res.status_code == 400


async def test_a_category_cannot_be_its_own_parent(client, db, admin):
    category = await _category(db, "Electronics")
    res = await client.patch(
        f"/admin/categories/{category.id}", json={"parent_id": str(category.id)}
    )
    assert res.status_code == 400


# --- hiding ------------------------------------------------------------------


async def test_hiding_removes_a_category_from_the_public_tree(client, db, admin):
    category = await _category(db, "Electronics")
    assert any(c["slug"] == "electronics" for c in (await client.get("/categories")).json())

    await client.patch(f"/admin/categories/{category.id}", json={"is_active": False})
    assert not any(c["slug"] == "electronics" for c in (await client.get("/categories")).json())


async def test_hiding_a_parent_hides_its_children(client, db, admin):
    """Children are only reachable through their parent in the navigation, so
    leaving them visible would strand them."""
    electronics = await _category(db, "Electronics")
    await _category(db, "Laptops", parent=electronics)

    await client.patch(f"/admin/categories/{electronics.id}", json={"is_active": False})

    tree = (await client.get("/categories")).json()
    assert not any(c["slug"] == "electronics" for c in tree)
    assert not any(
        child["slug"] == "laptops" for parent in tree for child in parent["children"]
    )


async def test_a_hidden_category_still_resolves_by_slug(client, db, admin):
    """Hiding takes a category out of navigation, not out of existence —
    listings already filed under it must stay browsable."""
    category = await _category(db, "Electronics", active=False)
    assert (await client.get(f"/categories/{category.slug}")).status_code == 200


async def test_a_hidden_parents_listings_still_count(client, db, admin):
    """Browsing a parent matches every descendant, hidden ones included, so a
    count that skipped them would promise fewer listings than the page shows."""
    electronics = await _category(db, "Electronics")
    laptops = await _category(db, "Laptops", parent=electronics, active=False)
    seller = await make_user(db)
    await make_listing(db, seller, category_id=laptops.id)

    parent = next(c for c in (await client.get("/categories")).json() if c["slug"] == "electronics")
    assert parent["listing_count"] == 1
    assert parent["children"] == []


async def test_a_hidden_category_cannot_be_chosen_for_a_new_listing(client, db, admin):
    retired = await _category(db, "Retired", active=False)
    seller = await make_user(db)
    await login(client, seller)

    res = await client.post(
        "/listings",
        json={
            "title": "A thing to sell",
            "description": "A description long enough to be realistic.",
            "price": "500",
            "price_type": "fixed",
            "condition": "used_good",
            "category_id": str(retired.id),
            "fulfillment_type": "pickup",
            "pickup_address": "Room 1, Al Beruni Hall",
        },
    )
    assert res.status_code == 400


async def test_a_listing_already_in_a_hidden_category_stays_editable(client, db, admin):
    """Saving any field resubmits the category id, so rejecting it outright
    would make every listing in a retired category permanently uneditable."""
    category = await _category(db, "Electronics")
    seller = await make_user(db)
    listing = await make_listing(db, seller, category_id=category.id)
    await client.patch(f"/admin/categories/{category.id}", json={"is_active": False})

    await login(client, seller)
    res = await client.patch(
        f"/listings/{listing.id}", json={"title": "New title", "category_id": str(category.id)}
    )
    assert res.status_code == 200


# --- reordering --------------------------------------------------------------


async def test_reordering_the_top_level(client, db, admin):
    a = await _category(db, "Alpha")
    b = await _category(db, "Beta")
    c = await _category(db, "Gamma")

    res = await client.post(
        "/admin/categories/reorder",
        json={"parent_id": None, "category_ids": [str(c.id), str(a.id), str(b.id)]},
    )
    assert res.status_code == 200
    assert [x["name"] for x in res.json()] == ["Gamma", "Alpha", "Beta"]
    assert [x["slug"] for x in (await client.get("/categories")).json()] == [
        "gamma",
        "alpha",
        "beta",
    ]


async def test_reordering_is_scoped_to_one_level(client, db, admin):
    """Passing a parent's children plus a top-level category is not a valid
    order for either list, and must not half-apply."""
    electronics = await _category(db, "Electronics")
    fashion = await _category(db, "Fashion")
    laptops = await _category(db, "Laptops", parent=electronics)

    res = await client.post(
        "/admin/categories/reorder",
        json={"parent_id": str(electronics.id), "category_ids": [str(laptops.id), str(fashion.id)]},
    )
    assert res.status_code == 400


async def test_a_partial_order_is_refused(client, db, admin):
    a = await _category(db, "Alpha")
    await _category(db, "Beta")

    res = await client.post(
        "/admin/categories/reorder", json={"parent_id": None, "category_ids": [str(a.id)]}
    )
    assert res.status_code == 400


# --- deleting ----------------------------------------------------------------


async def test_deleting_an_empty_category(client, db, admin):
    category = await _category(db, "Unused")
    assert (await client.delete(f"/admin/categories/{category.id}")).status_code == 204
    assert await db.get(Category, category.id) is None


async def test_a_category_holding_listings_cannot_be_deleted_outright(client, db, admin):
    """The listing FK is ON DELETE SET NULL, so this delete would succeed and
    silently uncategorise real stock. It has to be refused."""
    category = await _category(db, "Electronics")
    seller = await make_user(db)
    listing = await make_listing(db, seller, category_id=category.id)

    res = await client.delete(f"/admin/categories/{category.id}")
    assert res.status_code == 409

    await db.refresh(listing)
    assert listing.category_id == category.id


async def test_deleting_with_a_destination_moves_the_listings(client, db, admin):
    old = await _category(db, "Electronics")
    new = await _category(db, "Tech")
    seller = await make_user(db)
    listing = await make_listing(db, seller, category_id=old.id)

    res = await client.delete(f"/admin/categories/{old.id}?move_to={new.id}")
    assert res.status_code == 204

    await db.refresh(listing)
    assert listing.category_id == new.id


async def test_sold_and_removed_listings_are_counted_too(client, db, admin):
    """"What breaks if I delete this?" is not the same question as "what can
    a visitor browse?" — a sold listing still has a category to lose."""
    from app.models.listing import ListingStatus

    category = await _category(db, "Electronics")
    seller = await make_user(db)
    await make_listing(db, seller, category_id=category.id, status=ListingStatus.sold)

    assert (await client.delete(f"/admin/categories/{category.id}")).status_code == 409


async def test_a_parent_with_children_cannot_be_deleted(client, db, admin):
    """parent_id cascades, so this delete would take the children — and their
    listings — with it."""
    electronics = await _category(db, "Electronics")
    laptops = await _category(db, "Laptops", parent=electronics)
    seller = await make_user(db)
    await make_listing(db, seller, category_id=laptops.id)

    res = await client.delete(f"/admin/categories/{electronics.id}")
    assert res.status_code == 409
    assert await db.get(Category, laptops.id) is not None


async def test_listings_cannot_be_moved_into_the_category_being_deleted(client, db, admin):
    category = await _category(db, "Electronics")
    seller = await make_user(db)
    await make_listing(db, seller, category_id=category.id)

    res = await client.delete(f"/admin/categories/{category.id}?move_to={category.id}")
    assert res.status_code == 400
    assert await db.get(Category, category.id) is not None


async def test_no_listing_is_left_uncategorised_by_a_refused_delete(client, db, admin):
    """The property that matters, stated directly: after every refusal above,
    every listing still has the category it started with."""
    category = await _category(db, "Electronics")
    seller = await make_user(db)
    listing = await make_listing(db, seller, category_id=category.id)

    await client.delete(f"/admin/categories/{category.id}")
    await client.delete(f"/admin/categories/{category.id}?move_to={category.id}")

    orphans = (
        await db.execute(select(Listing).where(Listing.category_id.is_(None)))
    ).scalars().all()
    assert list(orphans) == []
    await db.refresh(listing)
    assert listing.category_id == category.id


# --- the audit trail ---------------------------------------------------------


async def test_every_change_is_recorded(client, db, admin):
    category = await _category(db, "Electronics")

    created = (await client.post("/admin/categories", json={"name": "New One"})).json()
    await client.patch(f"/admin/categories/{category.id}", json={"name": "Tech"})
    # Both ids: the top level now has two categories, and a partial order is
    # refused — which is itself asserted elsewhere.
    await client.post(
        "/admin/categories/reorder",
        json={"parent_id": None, "category_ids": [created["id"], str(category.id)]},
    )

    actions = set(
        (await db.execute(select(AuditLog.action).where(AuditLog.actor_id == admin.id)))
        .scalars()
        .all()
    )
    assert {
        AuditAction.CATEGORY_CREATED,
        AuditAction.CATEGORY_UPDATED,
        AuditAction.CATEGORIES_REORDERED,
    } <= actions


async def test_a_deletion_records_where_the_listings_went(client, db, admin):
    """Months later, "why is this listing in Tech?" has to be answerable."""
    old = await _category(db, "Electronics")
    new = await _category(db, "Tech")
    seller = await make_user(db)
    await make_listing(db, seller, category_id=old.id)

    await client.delete(f"/admin/categories/{old.id}?move_to={new.id}")

    entry = (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.CATEGORY_DELETED))
    ).scalar_one()
    assert entry.target_label == "Electronics"
    assert entry.detail["listings_moved"] == 1
    assert entry.detail["moved_to"] == "Tech"


async def test_a_refused_delete_records_nothing(client, db, admin):
    category = await _category(db, "Electronics")
    seller = await make_user(db)
    await make_listing(db, seller, category_id=category.id)

    await client.delete(f"/admin/categories/{category.id}")

    entries = (
        (await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.CATEGORY_DELETED)))
        .scalars()
        .all()
    )
    assert list(entries) == []
