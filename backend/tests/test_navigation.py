"""Navbar and footer navigation.

Navigation renders on every page, for signed-out visitors as well as members,
so the properties that matter are: the public endpoint shows only what an
admin has switched on, sign-in rules travel with the link rather than the
markup, and the seeded menus reproduce what the site shipped with.
"""

import pytest
from sqlalchemy import delete, select

from app.models.audit import AuditAction, AuditLog
from app.models.navigation import NavLink, NavLocation, NavMenu, NavVisibility, SiteSetting
from tests.conftest import login, make_user


@pytest.fixture(autouse=True)
async def clean_slate(request, db):
    """Start from empty menus, except where a test asks for the seed."""
    if request.node.get_closest_marker("keep_seed") is None:
        await db.execute(delete(NavLink))
        await db.execute(delete(NavMenu))
        await db.flush()


@pytest.fixture
async def admin(client, db):
    user = await make_user(db, role="admin")
    await login(client, user)
    return user


async def _menu(db, key: str, *, location=NavLocation.footer, order: int = 0, active: bool = True):
    menu = NavMenu(
        key=key,
        location=location,
        translation_key=None,
        label={"en": key.title()},
        sort_order=order,
        is_active=active,
    )
    db.add(menu)
    await db.flush()
    return menu


async def _link(
    db,
    menu,
    href: str,
    *,
    order: int = 0,
    active: bool = True,
    visibility: NavVisibility = NavVisibility.always,
):
    link = NavLink(
        menu_id=menu.id,
        translation_key=None,
        label={"en": href},
        href=href,
        sort_order=order,
        is_active=active,
        visibility=visibility,
    )
    db.add(link)
    await db.flush()
    return link


# --- what the migration seeded -----------------------------------------------


@pytest.mark.keep_seed
async def test_the_seed_reproduces_the_navigation_as_it_shipped(client, db):
    """The migration exists to make this change invisible on the day it lands.
    If this drifts, a deploy silently rearranged a live site's navigation."""
    body = (await client.get("/navigation")).json()
    menus = {m["key"]: m for m in body["menus"]}

    assert list(menus) == ["navbar", "footer-marketplace", "footer-account", "footer-campus"]
    assert [link["translation_key"] for link in menus["navbar"]["links"]] == [
        "nav.browse",
        "nav.browseShops",
        "nav.sell",
        "nav.inbox",
        "nav.myShops",
    ]
    # Sign-in rules moved from JSX to the row, and must match what the markup did.
    assert [link["visibility"] for link in menus["navbar"]["links"]] == [
        "always",
        "always",
        "signed_in",
        "signed_in",
        "signed_in",
    ]
    # No copy in the seed at all: every label resolves from the bundled
    # catalogues, so both languages stay correct.
    assert all(
        link["label"] == {} for menu in body["menus"] for link in menu["links"]
    )
    assert body["navbar_controls"] == {
        "search": True,
        "language": True,
        "theme": True,
        "notifications": True,
    }


# --- the public endpoint -----------------------------------------------------


async def test_public_endpoint_needs_no_login(client, db):
    await _menu(db, "footer-one")
    assert (await client.get("/navigation")).status_code == 200


async def test_hidden_menus_and_links_are_not_exposed(client, db):
    """Not merely hidden in the UI: something switched off should not be
    discoverable by reading the API either."""
    visible = await _menu(db, "visible", order=0)
    await _link(db, visible, "/shown", order=0)
    await _link(db, visible, "/hidden", order=1, active=False)
    await _menu(db, "hidden-menu", order=1, active=False)

    menus = (await client.get("/navigation")).json()["menus"]
    assert [m["key"] for m in menus] == ["visible"]
    assert [link["href"] for link in menus[0]["links"]] == ["/shown"]


async def test_menus_and_links_come_back_in_order(client, db):
    menu = await _menu(db, "footer-one")
    await _link(db, menu, "/third", order=2)
    await _link(db, menu, "/first", order=0)
    await _link(db, menu, "/second", order=1)

    links = (await client.get("/navigation")).json()["menus"][0]["links"]
    assert [link["href"] for link in links] == ["/first", "/second", "/third"]


async def test_visibility_travels_with_the_link(client, db):
    """The rule is data now, so the API has to carry it — the frontend cannot
    apply a rule it was never told about."""
    menu = await _menu(db, "footer-one")
    await _link(db, menu, "/members", visibility=NavVisibility.signed_in)

    link = (await client.get("/navigation")).json()["menus"][0]["links"][0]
    assert link["visibility"] == "signed_in"


# --- who may change it -------------------------------------------------------


async def test_anonymous_cannot_read_or_change_the_admin_navigation(client, db):
    assert (await client.get("/admin/navigation")).status_code in (401, 403)
    assert (
        await client.post("/admin/navigation/menus", json={"location": "footer"})
    ).status_code in (401, 403)


async def test_moderators_cannot_change_the_navigation(client, db):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/somewhere")
    moderator = await make_user(db, role="moderator")
    await login(client, moderator)

    assert (await client.get("/admin/navigation")).status_code == 403
    assert (
        await client.patch(f"/admin/navigation/links/{link.id}", json={"href": "/elsewhere"})
    ).status_code == 403
    assert (await client.delete(f"/admin/navigation/menus/{menu.id}")).status_code == 403


async def test_admin_list_includes_hidden_menus_and_links(client, db, admin):
    """An admin cannot switch back on what the screen never shows them."""
    menu = await _menu(db, "hidden-menu", active=False)
    await _link(db, menu, "/hidden", active=False)

    body = (await client.get("/admin/navigation")).json()
    assert [m["key"] for m in body["menus"]] == ["hidden-menu"]
    assert len(body["menus"][0]["links"]) == 1


# --- links -------------------------------------------------------------------


async def test_a_new_link_is_added_visible_at_the_end(client, db, admin):
    menu = await _menu(db, "footer-one")
    await _link(db, menu, "/first", order=0)

    res = await client.post(
        f"/admin/navigation/menus/{menu.id}/links",
        json={"label": {"en": "Support", "bn": "সহায়তা"}, "href": "/support"},
    )
    assert res.status_code == 201
    created = res.json()
    assert created["is_active"] is True
    assert created["sort_order"] == 1
    assert created["label"] == {"en": "Support", "bn": "সহায়তা"}
    # No bundled translation to fall back to, so an admin-created link
    # carries its own text.
    assert created["translation_key"] is None


async def test_editing_a_seeded_link_keeps_its_translation_key(client, db, admin):
    """Overriding English must not throw away the bundled Bangla — that is the
    whole point of storing an override rather than replacing the text."""
    menu = await _menu(db, "footer-one")
    link = NavLink(
        menu_id=menu.id,
        translation_key="footer.terms",
        label={},
        href="/terms",
        sort_order=0,
    )
    db.add(link)
    await db.flush()

    res = await client.patch(
        f"/admin/navigation/links/{link.id}", json={"label": {"en": "Our Terms"}}
    )
    assert res.status_code == 200
    assert res.json()["label"] == {"en": "Our Terms"}
    assert res.json()["translation_key"] == "footer.terms"


async def test_hiding_a_link_removes_it_from_the_public_navigation(client, db, admin):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/somewhere")

    await client.patch(f"/admin/navigation/links/{link.id}", json={"is_active": False})
    assert (await client.get("/navigation")).json()["menus"][0]["links"] == []


async def test_a_links_visibility_can_be_changed(client, db, admin):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/inbox")

    res = await client.patch(
        f"/admin/navigation/links/{link.id}", json={"visibility": "signed_in"}
    )
    assert res.json()["visibility"] == "signed_in"


async def test_deleting_a_link(client, db, admin):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/gone")

    assert (await client.delete(f"/admin/navigation/links/{link.id}")).status_code == 204
    assert await db.get(NavLink, link.id) is None


async def test_reordering_links(client, db, admin):
    menu = await _menu(db, "footer-one")
    a = await _link(db, menu, "/a", order=0)
    b = await _link(db, menu, "/b", order=1)
    c = await _link(db, menu, "/c", order=2)

    res = await client.post(
        f"/admin/navigation/menus/{menu.id}/links/reorder",
        json={"link_ids": [str(c.id), str(a.id), str(b.id)]},
    )
    assert res.status_code == 200
    assert [link["href"] for link in res.json()] == ["/c", "/a", "/b"]


async def test_a_partial_link_order_is_refused(client, db, admin):
    """A partial list leaves the omitted rows at stale positions and produces
    duplicate sort_orders, after which the menu renders in an arbitrary
    order — a silent corruption, so it has to be a loud error."""
    menu = await _menu(db, "footer-one")
    a = await _link(db, menu, "/a", order=0)
    await _link(db, menu, "/b", order=1)

    res = await client.post(
        f"/admin/navigation/menus/{menu.id}/links/reorder", json={"link_ids": [str(a.id)]}
    )
    assert res.status_code == 400


async def test_links_from_another_menu_are_refused(client, db, admin):
    one = await _menu(db, "footer-one", order=0)
    two = await _menu(db, "footer-two", order=1)
    a = await _link(db, one, "/a")
    b = await _link(db, two, "/b")

    res = await client.post(
        f"/admin/navigation/menus/{one.id}/links/reorder",
        json={"link_ids": [str(a.id), str(b.id)]},
    )
    assert res.status_code == 400


# --- menus -------------------------------------------------------------------


async def test_a_new_menu_starts_hidden(client, db, admin):
    """A new footer column appearing empty on every page of the site before
    the admin has filled it is not a state anyone should see."""
    res = await client.post(
        "/admin/navigation/menus", json={"location": "footer", "label": {"en": "Support"}}
    )
    assert res.status_code == 201
    assert res.json()["is_active"] is False
    assert (await client.get("/navigation")).json()["menus"] == []


async def test_menus_with_the_same_label_get_distinct_keys(client, db, admin):
    a = (
        await client.post(
            "/admin/navigation/menus", json={"location": "footer", "label": {"en": "Support"}}
        )
    ).json()
    b = (
        await client.post(
            "/admin/navigation/menus", json={"location": "footer", "label": {"en": "Support"}}
        )
    ).json()
    assert a["key"] != b["key"]


async def test_deleting_a_menu_takes_its_links(client, db, admin):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/inside")

    assert (await client.delete(f"/admin/navigation/menus/{menu.id}")).status_code == 204
    assert await db.get(NavMenu, menu.id) is None
    assert await db.get(NavLink, link.id) is None


async def test_reordering_menus_is_scoped_to_one_location(client, db, admin):
    """The navbar and the footer are separate lists; an order mixing them is
    not a valid order for either."""
    footer = await _menu(db, "footer-one", location=NavLocation.footer, order=0)
    navbar = await _menu(db, "navbar", location=NavLocation.navbar, order=0)

    res = await client.post(
        "/admin/navigation/menus/reorder",
        json={"location": "footer", "menu_ids": [str(footer.id), str(navbar.id)]},
    )
    assert res.status_code == 400


async def test_reordering_footer_columns(client, db, admin):
    a = await _menu(db, "footer-a", order=0)
    b = await _menu(db, "footer-b", order=1)

    res = await client.post(
        "/admin/navigation/menus/reorder",
        json={"location": "footer", "menu_ids": [str(b.id), str(a.id)]},
    )
    assert res.status_code == 200
    assert [m["key"] for m in (await client.get("/navigation")).json()["menus"]] == [
        "footer-b",
        "footer-a",
    ]


# --- navbar controls ---------------------------------------------------------


async def test_controls_default_to_on_when_nothing_is_stored(client, db, admin):
    """An empty or absent settings row must be a fully working navbar, not one
    with everything stripped out."""
    await db.execute(delete(SiteSetting))
    await db.flush()

    assert (await client.get("/navigation")).json()["navbar_controls"] == {
        "search": True,
        "language": True,
        "theme": True,
        "notifications": True,
    }


async def test_a_control_can_be_switched_off(client, db, admin):
    res = await client.put("/admin/navigation/controls", json={"controls": {"search": False}})
    assert res.status_code == 200
    assert res.json()["search"] is False
    # Only the named control changes.
    assert res.json()["theme"] is True
    assert (await client.get("/navigation")).json()["navbar_controls"]["search"] is False


async def test_unknown_controls_are_ignored(client, db, admin):
    """Storing them would be dead weight the frontend never reads, and
    accepting them silently would let a typo look like it had worked."""
    res = await client.put(
        "/admin/navigation/controls", json={"controls": {"telepathy": True, "theme": False}}
    )
    assert "telepathy" not in res.json()
    assert res.json()["theme"] is False


# --- the audit trail ---------------------------------------------------------


async def test_every_change_is_recorded(client, db, admin):
    menu = await _menu(db, "footer-one")
    link = await _link(db, menu, "/somewhere")

    await client.patch(f"/admin/navigation/links/{link.id}", json={"href": "/elsewhere"})
    await client.post(
        f"/admin/navigation/menus/{menu.id}/links", json={"label": {"en": "New"}, "href": "/new"}
    )
    await client.patch(f"/admin/navigation/menus/{menu.id}", json={"is_active": False})
    await client.put("/admin/navigation/controls", json={"controls": {"search": False}})
    await client.delete(f"/admin/navigation/links/{link.id}")

    actions = set(
        (await db.execute(select(AuditLog.action).where(AuditLog.actor_id == admin.id)))
        .scalars()
        .all()
    )
    assert {
        AuditAction.NAV_LINK_UPDATED,
        AuditAction.NAV_LINK_CREATED,
        AuditAction.NAV_MENU_UPDATED,
        AuditAction.NAVBAR_CONTROLS_CHANGED,
        AuditAction.NAV_LINK_DELETED,
    } <= actions


async def test_deleting_a_menu_records_what_it_contained(client, db, admin):
    """The links go with it, so the entry is the only remaining record of
    what the column pointed at."""
    menu = await _menu(db, "footer-one")
    await _link(db, menu, "/terms")

    await client.delete(f"/admin/navigation/menus/{menu.id}")

    entry = (
        await db.execute(select(AuditLog).where(AuditLog.action == AuditAction.NAV_MENU_DELETED))
    ).scalar_one()
    assert entry.detail["links"] == [{"href": "/terms", "key": None}]


async def test_a_refused_reorder_records_nothing(client, db, admin):
    menu = await _menu(db, "footer-one")
    a = await _link(db, menu, "/a", order=0)
    await _link(db, menu, "/b", order=1)

    await client.post(
        f"/admin/navigation/menus/{menu.id}/links/reorder", json={"link_ids": [str(a.id)]}
    )

    entries = (
        (
            await db.execute(
                select(AuditLog).where(AuditLog.action == AuditAction.NAV_LINKS_REORDERED)
            )
        )
        .scalars()
        .all()
    )
    assert list(entries) == []
