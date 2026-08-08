"""Search, suggestions and category filtering.

Covers two classes of defect specifically: the LIKE metacharacter handling
in `app/core/search.py`, and the suggestion filters fixed in Phase 29a.
"""

from sqlalchemy import text

from app.models.listing import ListingStatus
from app.services import listing_service
from tests.conftest import make_listing, make_user


# --- keyword search ---------------------------------------------------------


async def test_search_matches_title(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Organic Chemistry textbook")
    await make_listing(db, seller, title="Desk lamp")

    titles = [i["title"] for i in (await client.get("/listings?q=chemistry")).json()["items"]]
    assert "Organic Chemistry textbook" in titles
    assert "Desk lamp" not in titles


async def test_search_is_case_insensitive(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Bluetooth Headphones")

    res = await client.get("/listings?q=BLUETOOTH")
    assert any(i["title"] == "Bluetooth Headphones" for i in res.json()["items"])


async def test_percent_is_matched_literally_not_as_a_wildcard(client, db):
    """`%` is a LIKE wildcard. Unescaped, searching for it would match every
    listing instead of the one that actually contains it."""
    seller = await make_user(db)
    await make_listing(db, seller, title="50% cotton shirt")
    await make_listing(db, seller, title="Plain notebook")

    titles = [i["title"] for i in (await client.get("/listings?q=50%25")).json()["items"]]
    assert "50% cotton shirt" in titles
    assert "Plain notebook" not in titles


async def test_underscore_is_matched_literally(client, db):
    """`_` is LIKE's single-character wildcard, so an unescaped `a_c` would
    also match `abc`."""
    seller = await make_user(db)
    await make_listing(db, seller, title="file_name.pdf guide")
    await make_listing(db, seller, title="filexname guide")

    titles = [i["title"] for i in (await client.get("/listings?q=file_name")).json()["items"]]
    assert "file_name.pdf guide" in titles
    assert "filexname guide" not in titles


async def test_search_matches_tags(client, db):
    seller = await make_user(db)
    tagged = await make_listing(db, seller, title="Desk lamp")
    await listing_service._attach_tags(db, tagged, ["vintage"], replace=False)
    await make_listing(db, seller, title="Modern lamp")

    titles = [i["title"] for i in (await client.get("/listings?q=vintage")).json()["items"]]
    assert "Desk lamp" in titles
    assert "Modern lamp" not in titles


async def test_tag_search_is_case_insensitive(client, db):
    seller = await make_user(db)
    listing = await make_listing(db, seller, title="Bicycle")
    await listing_service._attach_tags(db, listing, ["Outdoor"], replace=False)

    res = await client.get("/listings?q=OUTDOOR")
    assert any(i["title"] == "Bicycle" for i in res.json()["items"])


async def test_backslash_search_does_not_error(client, db):
    """The escape character itself must round-trip cleanly."""
    seller = await make_user(db)
    await make_listing(db, seller, title="path\\to\\notes")

    res = await client.get("/listings?q=%5C")
    assert res.status_code == 200


# --- suggestions (Phase 29a regressions) ------------------------------------


async def test_suggestions_return_matching_titles(client, db):
    seller = await make_user(db)
    await make_listing(db, seller, title="Statistics for Engineers")

    res = await client.get("/listings/suggestions?q=stat")
    assert res.status_code == 200
    assert "Statistics for Engineers" in res.json()


async def test_suggestions_exclude_sold_listings(db):
    """Regression: suggestions filtered is_active but not status, so users
    were offered items that browse then refused to show."""
    seller = await make_user(db)
    await make_listing(db, seller, title="Sold Microscope", status=ListingStatus.sold)

    assert "Sold Microscope" not in await listing_service.get_search_suggestions(db, "micro", 10)


async def test_suggestions_exclude_deactivated_sellers(db):
    banned = await make_user(db, is_active=False)
    await make_listing(db, banned, title="Banned Seller Bicycle")

    assert "Banned Seller Bicycle" not in await listing_service.get_search_suggestions(db, "bicy", 10)


async def test_suggestions_deduplicate_and_respect_the_limit(db):
    """Regression: de-duplication ran after the limit, so identical titles
    from different sellers returned fewer suggestions than asked for."""
    seller = await make_user(db)
    for _ in range(6):
        await make_listing(db, seller, title="Identical Kettle")
    for i in range(3):
        await make_listing(db, seller, title=f"Identical Kettle variant {i}")

    results = await listing_service.get_search_suggestions(db, "identical", 3)
    assert len(results) == len(set(results))
    assert len(results) <= 3


async def test_suggestions_require_two_characters(client, db):
    assert (await client.get("/listings/suggestions?q=a")).status_code == 422


async def test_suggestions_route_does_not_shadow_the_listing_route(client, db):
    """`/listings/suggestions` is declared before `/listings/{id}`; a UUID
    must still reach the detail handler."""
    seller = await make_user(db)
    listing = await make_listing(db, seller)

    assert (await client.get(f"/listings/{listing.id}")).status_code == 200


# --- categories -------------------------------------------------------------


async def test_category_tree_is_two_levels_with_children(client):
    tree = (await client.get("/categories")).json()
    assert len(tree) > 0
    assert any(len(parent["children"]) > 0 for parent in tree)


async def test_filtering_by_a_parent_category_includes_its_children(client, db):
    row = await db.execute(
        text(
            "SELECT p.slug, c.id FROM categories p "
            "JOIN categories c ON c.parent_id = p.id LIMIT 1"
        )
    )
    parent_slug, child_id = row.one()

    seller = await make_user(db)
    await make_listing(db, seller, title="In a child category", category_id=child_id)

    res = await client.get(f"/listings?category={parent_slug}&limit=100")
    assert any(i["title"] == "In a child category" for i in res.json()["items"])


async def test_unknown_category_slug_is_404(client):
    assert (await client.get("/listings?category=not-a-real-category")).status_code == 404


async def test_category_counts_only_include_active_listings(client, db):
    row = await db.execute(
        text("SELECT id, slug FROM categories WHERE parent_id IS NOT NULL LIMIT 1")
    )
    cat_id, _ = row.one()

    seller = await make_user(db)
    await make_listing(db, seller, title="Active one", category_id=cat_id)
    await make_listing(db, seller, title="Sold one", category_id=cat_id, status=ListingStatus.sold)

    tree = (await client.get("/categories")).json()
    counts = {c["id"]: c["listing_count"] for parent in tree for c in parent["children"]}
    assert counts[str(cat_id)] == 1
