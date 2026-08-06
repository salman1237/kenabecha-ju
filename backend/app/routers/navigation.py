import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.navigation import (
    NavbarControlsIn,
    NavigationOut,
    NavLinkCreate,
    NavLinkOrderIn,
    NavLinkOut,
    NavLinkUpdate,
    NavMenuCreate,
    NavMenuOrderIn,
    NavMenuOut,
    NavMenuUpdate,
)
from app.services import announcement_service, navigation_service

# Public: the navbar and footer render on every page for signed-out visitors
# too, so this must not require authentication. Only active menus and links
# are returned — something hidden should not be discoverable by reading the
# API either.
public_router = APIRouter(prefix="/navigation", tags=["navigation"])


@public_router.get("", response_model=NavigationOut)
async def get_navigation(db: AsyncSession = Depends(get_db)) -> NavigationOut:
    return NavigationOut(
        menus=[
            NavMenuOut.model_validate(m)
            for m in await navigation_service.list_menus(db, active_only=True)
        ],
        navbar_controls=await navigation_service.get_navbar_controls(db),
        announcement=await announcement_service.get_live_announcement(db),
    )


# Admin: the shape of the site's navigation is administration, not moderation.
admin_router = APIRouter(
    prefix="/admin/navigation",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


@admin_router.get("", response_model=NavigationOut)
async def list_navigation(db: AsyncSession = Depends(get_db)) -> NavigationOut:
    """Includes hidden menus and links — the admin needs to see what it can
    turn back on."""
    return NavigationOut(
        menus=[
            NavMenuOut.model_validate(m)
            for m in await navigation_service.list_menus(db, active_only=False)
        ],
        navbar_controls=await navigation_service.get_navbar_controls(db),
    )


@admin_router.post("/menus", response_model=NavMenuOut, status_code=status.HTTP_201_CREATED)
async def create_menu(
    payload: NavMenuCreate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> NavMenuOut:
    menu = await navigation_service.create_menu(
        db, location=payload.location, label=payload.label, actor=actor
    )
    return NavMenuOut.model_validate(menu)


@admin_router.post("/menus/reorder", response_model=list[NavMenuOut])
async def reorder_menus(
    payload: NavMenuOrderIn,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[NavMenuOut]:
    menus = await navigation_service.reorder_menus(
        db, payload.location, payload.menu_ids, actor=actor
    )
    return [NavMenuOut.model_validate(m) for m in menus]


@admin_router.patch("/menus/{menu_id}", response_model=NavMenuOut)
async def update_menu(
    menu_id: uuid.UUID,
    payload: NavMenuUpdate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> NavMenuOut:
    menu = await navigation_service.update_menu(
        db, menu_id, label=payload.label, is_active=payload.is_active, actor=actor
    )
    return NavMenuOut.model_validate(menu)


@admin_router.delete("/menus/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_menu(
    menu_id: uuid.UUID,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await navigation_service.delete_menu(db, menu_id, actor=actor)


@admin_router.post(
    "/menus/{menu_id}/links", response_model=NavLinkOut, status_code=status.HTTP_201_CREATED
)
async def create_link(
    menu_id: uuid.UUID,
    payload: NavLinkCreate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> NavLinkOut:
    link = await navigation_service.create_link(
        db,
        menu_id,
        label=payload.label,
        href=payload.href,
        icon=payload.icon,
        visibility=payload.visibility,
        actor=actor,
    )
    return NavLinkOut.model_validate(link)


@admin_router.post("/menus/{menu_id}/links/reorder", response_model=list[NavLinkOut])
async def reorder_links(
    menu_id: uuid.UUID,
    payload: NavLinkOrderIn,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[NavLinkOut]:
    links = await navigation_service.reorder_links(db, menu_id, payload.link_ids, actor=actor)
    return [NavLinkOut.model_validate(link) for link in links]


@admin_router.patch("/links/{link_id}", response_model=NavLinkOut)
async def update_link(
    link_id: uuid.UUID,
    payload: NavLinkUpdate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> NavLinkOut:
    link = await navigation_service.update_link(
        db,
        link_id,
        label=payload.label,
        href=payload.href,
        icon=payload.icon,
        icon_set="icon" in payload.model_fields_set,
        visibility=payload.visibility,
        is_active=payload.is_active,
        actor=actor,
    )
    return NavLinkOut.model_validate(link)


@admin_router.delete("/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    link_id: uuid.UUID,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await navigation_service.delete_link(db, link_id, actor=actor)


@admin_router.put("/controls", response_model=dict[str, bool])
async def set_navbar_controls(
    payload: NavbarControlsIn,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    return await navigation_service.set_navbar_controls(db, payload.controls, actor=actor)
