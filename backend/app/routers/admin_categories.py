import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.category import (
    AdminCategoryOut,
    CategoryCreate,
    CategoryOrderIn,
    CategoryUpdate,
)
from app.services import category_service

# The taxonomy is administration, not moderation: reshaping it changes what
# every seller can file a listing under and what every buyer can browse. Sits
# behind get_current_admin, like the landing page.
router = APIRouter(
    prefix="/admin/categories",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


async def _serialise(db: AsyncSession, categories: list) -> list[AdminCategoryOut]:
    """Attach listing counts in one grouped query rather than one per row."""
    counts = await category_service.listing_counts(db, [c.id for c in categories])
    return [
        AdminCategoryOut(
            **{
                field: getattr(category, field)
                for field in ("id", "name", "slug", "icon", "parent_id", "sort_order", "is_active")
            },
            listing_count=counts.get(category.id, 0),
        )
        for category in categories
    ]


@router.get("", response_model=list[AdminCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)) -> list[AdminCategoryOut]:
    """Every category, hidden ones included, with the listing count that
    decides whether each can safely be deleted."""
    return await _serialise(db, await category_service.list_all(db))


@router.post("", response_model=AdminCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminCategoryOut:
    category = await category_service.create_category(
        db, name=payload.name, icon=payload.icon, parent_id=payload.parent_id, actor=actor
    )
    return (await _serialise(db, [category]))[0]


@router.post("/reorder", response_model=list[AdminCategoryOut])
async def reorder_categories(
    payload: CategoryOrderIn,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminCategoryOut]:
    categories = await category_service.reorder_categories(
        db, payload.parent_id, payload.category_ids, actor=actor
    )
    return await _serialise(db, categories)


@router.patch("/{category_id}", response_model=AdminCategoryOut)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminCategoryOut:
    # `model_fields_set` is what separates "icon: null" (clear it) from an
    # absent key (leave it). Both arrive as None otherwise.
    sent = payload.model_fields_set
    category = await category_service.update_category(
        db,
        category_id,
        name=payload.name,
        slug=payload.slug,
        icon=payload.icon,
        icon_set="icon" in sent,
        parent_id=payload.parent_id,
        parent_set="parent_id" in sent,
        is_active=payload.is_active,
        actor=actor,
    )
    return (await _serialise(db, [category]))[0]


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    move_to: uuid.UUID | None = None,
    actor: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """`move_to` names where any listings in this category should go. Required
    when the category holds any — see the service for why."""
    await category_service.delete_category(db, category_id, move_to_id=move_to, actor=actor)
