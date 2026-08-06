"""Landing page sections.

The homepage is now data, which means a bug here is not a broken feature —
it is a broken front door. These tests care about three things: the public
endpoint only ever exposes what an admin has switched on, the ordering is
total and stays that way, and nothing but an admin can change any of it.
"""

import pytest
from sqlalchemy import delete, select

from app.models.audit import AuditAction, AuditLog
from app.models.page_section import PageSection, SectionType
from tests.conftest import login, make_user


@pytest.fixture(autouse=True)
async def clean_slate(request, db):
    """Start from an empty table.

    The initial migration seeds the ten sections the site shipped with, which
    is right for a real database and wrong for a test that wants to assert on
    exactly three. Tests marked `keep_seed` opt out and get the seeded rows.
    """
    if request.node.get_closest_marker("keep_seed") is None:
        await db.execute(delete(PageSection))
        await db.flush()


async def _sections(db) -> list[PageSection]:
    return list(
        (await db.execute(select(PageSection).order_by(PageSection.sort_order))).scalars().all()
    )


async def _add(db, key: str, section_type: SectionType, order: int, *, active: bool = True):
    section = PageSection(
        key=key, section_type=section_type, sort_order=order, is_active=active, settings={}
    )
    db.add(section)
    await db.flush()
    return section


# --- what the migration seeded -----------------------------------------------


@pytest.mark.keep_seed
async def test_the_seed_reproduces_the_page_as_it_shipped(client, db):
    """The migration exists to make this change invisible on the day it lands.
    If this list ever drifts, an existing site got silently rearranged by a
    deploy."""
    sections = (await client.get("/page-sections")).json()
    assert [s["section_type"] for s in sections] == [
        "hero",
        "stats",
        "top_products",
        "latest_listings",
        "featured_shops",
        "categories",
        "how_it_works",
        "reviews",
        "cta",
        "newsletter",
    ]
    # Empty settings throughout, so every section renders its bundled copy.
    assert all(s["settings"] == {} for s in sections)


# --- the public endpoint -----------------------------------------------------


async def test_public_endpoint_needs_no_login(client, db):
    await _add(db, "hero", SectionType.hero, 0)
    res = await client.get("/page-sections")
    assert res.status_code == 200


async def test_public_endpoint_hides_inactive_sections(client, db):
    await _add(db, "hero", SectionType.hero, 0)
    await _add(db, "cta", SectionType.cta, 1, active=False)

    keys = [s["key"] for s in (await client.get("/page-sections")).json()]
    assert keys == ["hero"]


async def test_public_endpoint_respects_sort_order(client, db):
    await _add(db, "cta", SectionType.cta, 5)
    await _add(db, "hero", SectionType.hero, 1)
    await _add(db, "stats", SectionType.stats, 3)

    keys = [s["key"] for s in (await client.get("/page-sections")).json()]
    assert keys == ["hero", "stats", "cta"]


# --- who may change it -------------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/admin/sections"),
        ("post", "/admin/sections"),
        ("post", "/admin/sections/reorder"),
    ],
)
async def test_anonymous_cannot_touch_sections(client, db, method, path):
    kwargs = {"json": {}} if method == "post" else {}
    res = await getattr(client, method)(path, **kwargs)
    assert res.status_code in (401, 403)


async def test_moderators_cannot_change_the_landing_page(client, db):
    """Moderators police content; the shape of the homepage is not content."""
    section = await _add(db, "hero", SectionType.hero, 0)
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.get("/admin/sections")).status_code == 403
    assert (
        await client.patch(f"/admin/sections/{section.id}", json={"is_active": False})
    ).status_code == 403
    assert (await client.delete(f"/admin/sections/{section.id}")).status_code == 403


async def test_admin_list_includes_hidden_sections(client, db):
    """An admin cannot switch on what the screen never shows them."""
    await _add(db, "hero", SectionType.hero, 0)
    await _add(db, "cta", SectionType.cta, 1, active=False)
    await login(client, await make_user(db, role="admin"))

    keys = [s["key"] for s in (await client.get("/admin/sections")).json()]
    assert keys == ["hero", "cta"]


# --- editing -----------------------------------------------------------------


async def test_hiding_a_section_removes_it_from_the_public_page(client, db):
    section = await _add(db, "cta", SectionType.cta, 0)
    await login(client, await make_user(db, role="admin"))

    res = await client.patch(f"/admin/sections/{section.id}", json={"is_active": False})
    assert res.status_code == 200
    assert res.json()["is_active"] is False
    assert (await client.get("/page-sections")).json() == []


async def test_settings_are_replaced_not_merged(client, db):
    """Merging would make clearing a field impossible — an admin who deletes
    the text they added would find it still on the page."""
    section = await _add(db, "cta", SectionType.cta, 0)
    section.settings = {"title": {"en": "Old"}, "button": {"en": "Go"}}
    await db.flush()
    await login(client, await make_user(db, role="admin"))

    res = await client.patch(
        f"/admin/sections/{section.id}", json={"settings": {"title": {"en": "New"}}}
    )
    assert res.json()["settings"] == {"title": {"en": "New"}}


async def test_copy_is_stored_per_locale(client, db):
    section = await _add(db, "cta", SectionType.cta, 0)
    await login(client, await make_user(db, role="admin"))

    await client.patch(
        f"/admin/sections/{section.id}",
        json={"settings": {"title": {"en": "Join us", "bn": "যোগ দিন"}}},
    )

    public = (await client.get("/page-sections")).json()[0]
    assert public["settings"]["title"] == {"en": "Join us", "bn": "যোগ দিন"}


# --- adding and removing -----------------------------------------------------


async def test_a_new_section_starts_hidden_and_last(client, db):
    """So that adding one does not change the live homepage before the admin
    has had a chance to write its copy."""
    await _add(db, "hero", SectionType.hero, 0)
    await login(client, await make_user(db, role="admin"))

    res = await client.post("/admin/sections", json={"section_type": "cta"})
    assert res.status_code in (200, 201)
    created = res.json()
    assert created["is_active"] is False
    assert created["sort_order"] == 1
    assert [s["key"] for s in (await client.get("/page-sections")).json()] == ["hero"]


async def test_adding_a_duplicate_type_gets_its_own_key(client, db):
    """Two listing rails with different titles is a legitimate layout, so a
    collision must not be an error the admin has to work around."""
    await login(client, await make_user(db, role="admin"))

    first = (await client.post("/admin/sections", json={"section_type": "latest_listings"})).json()
    second = (await client.post("/admin/sections", json={"section_type": "latest_listings"})).json()

    assert first["key"] != second["key"]


async def test_an_unknown_type_is_rejected(client, db):
    await login(client, await make_user(db, role="admin"))
    res = await client.post("/admin/sections", json={"section_type": "carousel_of_doom"})
    assert res.status_code == 422


async def test_deleting_removes_the_section(client, db):
    section = await _add(db, "cta", SectionType.cta, 0)
    await login(client, await make_user(db, role="admin"))

    assert (await client.delete(f"/admin/sections/{section.id}")).status_code in (200, 204)
    assert await _sections(db) == []


async def test_a_deleted_type_can_be_added_back(client, db):
    section = await _add(db, "cta", SectionType.cta, 0)
    await login(client, await make_user(db, role="admin"))
    await client.delete(f"/admin/sections/{section.id}")

    res = await client.post("/admin/sections", json={"section_type": "cta"})
    assert res.status_code in (200, 201)


# --- reordering --------------------------------------------------------------


async def test_reorder_applies_the_given_order(client, db):
    a = await _add(db, "hero", SectionType.hero, 0)
    b = await _add(db, "stats", SectionType.stats, 1)
    c = await _add(db, "cta", SectionType.cta, 2)
    await login(client, await make_user(db, role="admin"))

    res = await client.post(
        "/admin/sections/reorder", json={"section_ids": [str(c.id), str(a.id), str(b.id)]}
    )
    assert res.status_code == 200
    assert [s["key"] for s in res.json()] == ["cta", "hero", "stats"]
    assert [s["key"] for s in (await client.get("/page-sections")).json()] == [
        "cta",
        "hero",
        "stats",
    ]


async def test_a_partial_order_is_refused(client, db):
    """Omitting a section would leave it at a stale position and produce
    duplicate sort_orders, after which the page renders in an arbitrary
    order — a silent corruption, so it has to be a loud error."""
    a = await _add(db, "hero", SectionType.hero, 0)
    await _add(db, "stats", SectionType.stats, 1)
    await login(client, await make_user(db, role="admin"))

    res = await client.post("/admin/sections/reorder", json={"section_ids": [str(a.id)]})
    assert res.status_code == 400
    assert [s.key for s in await _sections(db)] == ["hero", "stats"]


async def test_a_duplicated_id_is_refused(client, db):
    a = await _add(db, "hero", SectionType.hero, 0)
    await _add(db, "stats", SectionType.stats, 1)
    await login(client, await make_user(db, role="admin"))

    res = await client.post(
        "/admin/sections/reorder", json={"section_ids": [str(a.id), str(a.id)]}
    )
    assert res.status_code == 400


async def test_hidden_sections_keep_their_place_in_the_order(client, db):
    """Otherwise hiding a section and showing it again would move it, and
    hiding would stop being the safe, reversible option it is meant to be."""
    a = await _add(db, "hero", SectionType.hero, 0)
    b = await _add(db, "stats", SectionType.stats, 1, active=False)
    c = await _add(db, "cta", SectionType.cta, 2)
    await login(client, await make_user(db, role="admin"))

    await client.post(
        "/admin/sections/reorder", json={"section_ids": [str(a.id), str(b.id), str(c.id)]}
    )
    await client.patch(f"/admin/sections/{b.id}", json={"is_active": True})

    assert [s["key"] for s in (await client.get("/page-sections")).json()] == [
        "hero",
        "stats",
        "cta",
    ]


# --- the audit trail ---------------------------------------------------------


async def test_every_change_is_recorded(client, db):
    section = await _add(db, "cta", SectionType.cta, 0)
    admin = await make_user(db, role="admin")
    await login(client, admin)

    await client.patch(f"/admin/sections/{section.id}", json={"is_active": False})
    await client.post("/admin/sections/reorder", json={"section_ids": [str(section.id)]})
    await client.delete(f"/admin/sections/{section.id}")
    await client.post("/admin/sections", json={"section_type": "hero"})

    actions = set(
        (await db.execute(select(AuditLog.action).where(AuditLog.actor_id == admin.id)))
        .scalars()
        .all()
    )
    assert {
        AuditAction.SECTION_UPDATED,
        AuditAction.SECTIONS_REORDERED,
        AuditAction.SECTION_DELETED,
        AuditAction.SECTION_CREATED,
    } <= actions


async def test_a_deletion_records_what_was_lost(client, db):
    """The section is gone and its copy with it, so the entry is the only
    remaining answer to 'what did that say?'."""
    section = await _add(db, "cta", SectionType.cta, 0)
    section.settings = {"title": {"en": "Join the marketplace"}}
    await db.flush()
    await login(client, await make_user(db, role="admin"))

    await client.delete(f"/admin/sections/{section.id}")

    entry = (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.SECTION_DELETED))
    ).scalar_one()
    assert entry.detail["settings"] == {"title": {"en": "Join the marketplace"}}
    assert entry.target_label == "cta"


async def test_a_refused_reorder_records_nothing(client, db):
    a = await _add(db, "hero", SectionType.hero, 0)
    await _add(db, "stats", SectionType.stats, 1)
    await login(client, await make_user(db, role="admin"))

    await client.post("/admin/sections/reorder", json={"section_ids": [str(a.id)]})

    entries = (
        (await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.SECTIONS_REORDERED)))
        .scalars()
        .all()
    )
    assert list(entries) == []
