import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, ErrorCode
from app.models.category import Category
from app.models.listing import Listing, ListingStatus


async def _active_counts(db: AsyncSession) -> dict[uuid.UUID, int]:
    """Active-listing count per category, in one grouped query.

    Deliberately not one query per category — that's the N+1 pattern the
    audit flagged on shops (LOGIC-04), and a sidebar renders every category
    at once.
    """
    rows = await db.execute(
        select(Listing.category_id, func.count(Listing.id))
        .where(
            Listing.category_id.is_not(None),
            Listing.status == ListingStatus.active,
            Listing.deleted_at.is_(None),
        )
        .group_by(Listing.category_id)
    )
    return {cid: count for cid, count in rows.all()}


async def list_tree(db: AsyncSession) -> list[dict]:
    """Top-level categories with their children and listing counts.

    A parent's count includes its children's, since browsing "Electronics"
    shows everything beneath it — a parent showing 0 while its children
    show 40 would read as a bug.
    """
    result = await db.execute(
        select(Category)
        .where(Category.parent_id.is_(None))
        .options(selectinload(Category.children))
        .order_by(Category.sort_order)
    )
    parents = list(result.scalars().unique().all())
    counts = await _active_counts(db)

    tree = []
    for parent in parents:
        children = [
            {
                "id": child.id,
                "name": child.name,
                "slug": child.slug,
                "icon": child.icon or parent.icon,
                "listing_count": counts.get(child.id, 0),
            }
            for child in parent.children
        ]
        tree.append(
            {
                "id": parent.id,
                "name": parent.name,
                "slug": parent.slug,
                "icon": parent.icon,
                "listing_count": counts.get(parent.id, 0) + sum(c["listing_count"] for c in children),
                "children": children,
            }
        )
    return tree


async def get_by_slug(db: AsyncSession, slug: str) -> Category:
    result = await db.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return category


async def ensure_exists(db: AsyncSession, category_id: uuid.UUID | None) -> None:
    """Reject an unknown category_id with a 400 before it reaches the FK.

    Without this the insert raises ForeignKeyViolationError, which surfaces as
    a 500 — a client sending a bad id is a client error, not a server fault.
    """
    if category_id is None:
        return
    exists = await db.execute(select(Category.id).where(Category.id == category_id))
    if exists.scalar_one_or_none() is None:
        raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.UNKNOWN_CATEGORY, "Unknown category")


async def descendant_ids(db: AsyncSession, category: Category) -> list[uuid.UUID]:
    """The category itself plus its children.

    Only one level deep because the taxonomy is fixed at two levels — if
    that ever changes this needs a recursive CTE, which is exactly why the
    depth limit is documented on the model.
    """
    rows = await db.execute(select(Category.id).where(Category.parent_id == category.id))
    return [category.id, *rows.scalars().all()]
