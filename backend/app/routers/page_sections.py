import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.page_section import (
    PageSectionCreate,
    PageSectionOrderIn,
    PageSectionOut,
    PageSectionUpdate,
)
from app.services import page_section_service

# Public: the landing page reads this on every render, so it must not require
# authentication. Only active sections are returned — a hidden section should
# not be discoverable by reading the API either.
public_router = APIRouter(prefix="/page-sections", tags=["page-sections"])


@public_router.get("", response_model=list[PageSectionOut])
async def list_public_sections(db: AsyncSession = Depends(get_db)) -> list[PageSectionOut]:
    sections = await page_section_service.list_sections(db, active_only=True)
    return [PageSectionOut.model_validate(s) for s in sections]


# Admin: editing the site is administration, not moderation, so this sits
# behind get_current_admin rather than the router-level staff guard.
admin_router = APIRouter(
    prefix="/admin/sections",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


@admin_router.get("", response_model=list[PageSectionOut])
async def list_all_sections(db: AsyncSession = Depends(get_db)) -> list[PageSectionOut]:
    """Includes hidden sections — the admin needs to see what it can turn on."""
    sections = await page_section_service.list_sections(db, active_only=False)
    return [PageSectionOut.model_validate(s) for s in sections]


@admin_router.post("", response_model=PageSectionOut, status_code=status.HTTP_201_CREATED)
async def create_section(
    payload: PageSectionCreate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> PageSectionOut:
    section = await page_section_service.create_section(db, payload.section_type, actor=actor)
    return PageSectionOut.model_validate(section)


@admin_router.post("/reorder", response_model=list[PageSectionOut])
async def reorder_sections(
    payload: PageSectionOrderIn,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[PageSectionOut]:
    sections = await page_section_service.reorder_sections(db, payload.section_ids, actor=actor)
    return [PageSectionOut.model_validate(s) for s in sections]


@admin_router.patch("/{section_id}", response_model=PageSectionOut)
async def update_section(
    section_id: uuid.UUID,
    payload: PageSectionUpdate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> PageSectionOut:
    section = await page_section_service.update_section(
        db, section_id, is_active=payload.is_active, settings=payload.settings, actor=actor
    )
    return PageSectionOut.model_validate(section)


@admin_router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: uuid.UUID,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    await page_section_service.delete_section(db, section_id, actor=actor)
