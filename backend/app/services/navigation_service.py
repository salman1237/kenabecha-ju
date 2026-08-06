import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditAction
from app.models.navigation import (
    NAVBAR_CONTROLS,
    NAVBAR_CONTROLS_KEY,
    NavLink,
    NavLocation,
    NavMenu,
    NavVisibility,
    SiteSetting,
)
from app.models.user import User
from app.services import audit_service


async def list_menus(db: AsyncSession, *, active_only: bool) -> list[NavMenu]:
    """Menus with their links, ordered.

    `active_only` is the public view. A hidden menu takes its links with it —
    they are only reachable through it — and hidden links drop out of the
    menus that remain.
    """
    query = (
        select(NavMenu)
        .options(selectinload(NavMenu.links))
        .order_by(NavMenu.location, NavMenu.sort_order)
    )
    if active_only:
        query = query.where(NavMenu.is_active.is_(True))
    menus = list((await db.execute(query)).scalars().unique().all())

    if active_only:
        for menu in menus:
            # Filtering the loaded collection rather than issuing a second
            # query per menu: the navbar and footer render on every page, so
            # this runs constantly.
            menu.links = [link for link in menu.links if link.is_active]
    return menus


async def _get_menu(db: AsyncSession, menu_id: uuid.UUID) -> NavMenu:
    menu = await db.get(NavMenu, menu_id)
    if menu is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu not found")
    return menu


async def _get_link(db: AsyncSession, link_id: uuid.UUID) -> NavLink:
    link = await db.get(NavLink, link_id)
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Link not found")
    return link


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:56] or "menu"


async def _unique_key(db: AsyncSession, base: str) -> str:
    key = _slugify(base)
    taken = set(
        (await db.execute(select(NavMenu.key).where(NavMenu.key.like(f"{key}%")))).scalars().all()
    )
    if key not in taken:
        return key
    for n in range(2, 100):
        candidate = f"{key}-{n}"
        if candidate not in taken:
            return candidate
    return f"{key}-{uuid.uuid4().hex[:6]}"


# --- menus -------------------------------------------------------------------


async def create_menu(
    db: AsyncSession, *, location: NavLocation, label: dict, actor: User
) -> NavMenu:
    """Add a footer column, or a second navbar menu.

    Created hidden, like a page section: a new column appearing empty on
    every page of the site before the admin has filled it is not a state
    anyone should see.
    """
    max_order = (
        await db.execute(
            select(func.coalesce(func.max(NavMenu.sort_order), -1)).where(
                NavMenu.location == location
            )
        )
    ).scalar_one()

    # Keyed off the English label when there is one, so the key stays
    # readable in the audit log and the database.
    base = label.get("en") or label.get("bn") or location.value
    menu = NavMenu(
        key=await _unique_key(db, base),
        location=location,
        translation_key=None,
        label=label,
        sort_order=max_order + 1,
        is_active=False,
    )
    db.add(menu)
    await db.flush()

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_MENU_CREATED,
        target_type="nav_menu",
        target_id=menu.id,
        target_label=menu.key,
        detail={"location": location.value},
    )
    await db.commit()
    await db.refresh(menu)
    return menu


async def update_menu(
    db: AsyncSession,
    menu_id: uuid.UUID,
    *,
    label: dict | None = None,
    is_active: bool | None = None,
    actor: User,
) -> NavMenu:
    menu = await _get_menu(db, menu_id)
    changed: dict = {}

    if label is not None and label != menu.label:
        # Replaced, not merged: the editor submits the whole object, and
        # merging would make clearing a heading impossible.
        changed["label"] = {"from": menu.label, "to": label}
        menu.label = label

    if is_active is not None and is_active != menu.is_active:
        changed["is_active"] = {"from": menu.is_active, "to": is_active}
        menu.is_active = is_active

    if changed:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.NAV_MENU_UPDATED,
            target_type="nav_menu",
            target_id=menu.id,
            target_label=menu.key,
            detail=changed,
        )
    await db.commit()
    await db.refresh(menu)
    return menu


async def delete_menu(db: AsyncSession, menu_id: uuid.UUID, *, actor: User) -> None:
    """Remove a menu and the links inside it.

    Unlike a category, nothing outside the menu points at its links, so a
    cascade here loses no data that exists anywhere else. The audit entry
    keeps a record of what the menu contained.
    """
    menu = await _get_menu(db, menu_id)
    await db.refresh(menu, ["links"])

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_MENU_DELETED,
        target_type="nav_menu",
        target_id=menu.id,
        target_label=menu.key,
        detail={
            "location": menu.location.value,
            "links": [{"href": link.href, "key": link.translation_key} for link in menu.links],
        },
    )
    await db.delete(menu)
    await db.commit()


async def reorder_menus(
    db: AsyncSession, location: NavLocation, menu_ids: list[uuid.UUID], *, actor: User
) -> list[NavMenu]:
    """Order the menus in one location. Every menu there, exactly once."""
    current = {
        m.id: m
        for m in (await db.execute(select(NavMenu).where(NavMenu.location == location)))
        .scalars()
        .all()
    }
    if set(menu_ids) != set(current) or len(menu_ids) != len(current):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The order must list every menu in this location exactly once",
        )
    for index, menu_id in enumerate(menu_ids):
        current[menu_id].sort_order = index

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_MENUS_REORDERED,
        target_type="nav_menu",
        detail={"location": location.value, "order": [current[i].key for i in menu_ids]},
    )
    await db.commit()
    return await list_menus(db, active_only=False)


# --- links -------------------------------------------------------------------


async def create_link(
    db: AsyncSession,
    menu_id: uuid.UUID,
    *,
    label: dict,
    href: str,
    icon: str | None,
    visibility: NavVisibility,
    actor: User,
) -> NavLink:
    """Add a link to the end of a menu.

    Visible immediately, unlike a menu: a single extra link cannot leave the
    site looking half-built, and having to switch it on separately would be
    friction for the commonest action on this screen.
    """
    menu = await _get_menu(db, menu_id)
    max_order = (
        await db.execute(
            select(func.coalesce(func.max(NavLink.sort_order), -1)).where(
                NavLink.menu_id == menu.id
            )
        )
    ).scalar_one()

    link = NavLink(
        menu_id=menu.id,
        # Admin-created links carry their own text; only seeded ones resolve
        # against the bundled catalogues.
        translation_key=None,
        label=label,
        href=href.strip(),
        icon=icon or None,
        sort_order=max_order + 1,
        is_active=True,
        visibility=visibility,
    )
    db.add(link)
    await db.flush()

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_LINK_CREATED,
        target_type="nav_link",
        target_id=link.id,
        target_label=label.get("en") or href,
        detail={"menu": menu.key, "href": link.href},
    )
    await db.commit()
    await db.refresh(link)
    return link


async def update_link(
    db: AsyncSession,
    link_id: uuid.UUID,
    *,
    label: dict | None = None,
    href: str | None = None,
    icon: str | None = None,
    icon_set: bool = False,
    visibility: NavVisibility | None = None,
    is_active: bool | None = None,
    actor: User,
) -> NavLink:
    link = await _get_link(db, link_id)
    changed: dict = {}

    if label is not None and label != link.label:
        changed["label"] = {"from": link.label, "to": label}
        link.label = label

    if href is not None and href.strip() and href.strip() != link.href:
        changed["href"] = {"from": link.href, "to": href.strip()}
        link.href = href.strip()

    if icon_set and (icon or None) != link.icon:
        changed["icon"] = {"from": link.icon, "to": icon or None}
        link.icon = icon or None

    if visibility is not None and visibility != link.visibility:
        changed["visibility"] = {"from": link.visibility.value, "to": visibility.value}
        link.visibility = visibility

    if is_active is not None and is_active != link.is_active:
        changed["is_active"] = {"from": link.is_active, "to": is_active}
        link.is_active = is_active

    if changed:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.NAV_LINK_UPDATED,
            target_type="nav_link",
            target_id=link.id,
            target_label=link.label.get("en") or link.translation_key or link.href,
            detail=changed,
        )
    await db.commit()
    await db.refresh(link)
    return link


async def delete_link(db: AsyncSession, link_id: uuid.UUID, *, actor: User) -> None:
    link = await _get_link(db, link_id)
    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_LINK_DELETED,
        target_type="nav_link",
        target_id=link.id,
        target_label=link.label.get("en") or link.translation_key or link.href,
        detail={"href": link.href, "translation_key": link.translation_key},
    )
    await db.delete(link)
    await db.commit()


async def reorder_links(
    db: AsyncSession, menu_id: uuid.UUID, link_ids: list[uuid.UUID], *, actor: User
) -> list[NavLink]:
    """Order the links in one menu. Every link in it, exactly once."""
    menu = await _get_menu(db, menu_id)
    current = {
        link.id: link
        for link in (await db.execute(select(NavLink).where(NavLink.menu_id == menu.id)))
        .scalars()
        .all()
    }
    if set(link_ids) != set(current) or len(link_ids) != len(current):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The order must list every link in this menu exactly once",
        )
    for index, link_id in enumerate(link_ids):
        current[link_id].sort_order = index

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.NAV_LINKS_REORDERED,
        target_type="nav_menu",
        target_id=menu.id,
        target_label=menu.key,
        detail={"order": [str(i) for i in link_ids]},
    )
    await db.commit()
    return sorted(current.values(), key=lambda link: link.sort_order)


# --- navbar controls ---------------------------------------------------------


async def get_navbar_controls(db: AsyncSession) -> dict[str, bool]:
    """Which navbar controls are switched on.

    Missing keys take their default, so an empty or absent row is a fully
    working navbar rather than one with everything stripped out.
    """
    row = (
        await db.execute(select(SiteSetting).where(SiteSetting.key == NAVBAR_CONTROLS_KEY))
    ).scalar_one_or_none()
    stored = row.value if row else {}
    return {name: bool(stored.get(name, default)) for name, default in NAVBAR_CONTROLS.items()}


async def set_navbar_controls(
    db: AsyncSession, controls: dict[str, bool], *, actor: User
) -> dict[str, bool]:
    """Switch navbar controls on or off.

    Unknown names are dropped rather than stored: they would be dead weight
    the frontend never reads, and silently accepting them would let a typo
    look like it had worked.
    """
    row = (
        await db.execute(select(SiteSetting).where(SiteSetting.key == NAVBAR_CONTROLS_KEY))
    ).scalar_one_or_none()
    if row is None:
        row = SiteSetting(key=NAVBAR_CONTROLS_KEY, value={})
        db.add(row)

    merged = {**await get_navbar_controls(db)}
    for name, enabled in controls.items():
        if name in NAVBAR_CONTROLS:
            merged[name] = bool(enabled)

    if merged != row.value:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.NAVBAR_CONTROLS_CHANGED,
            target_type="site_setting",
            target_label=NAVBAR_CONTROLS_KEY,
            detail={"from": row.value, "to": merged},
        )
    row.value = merged
    await db.commit()
    return merged
