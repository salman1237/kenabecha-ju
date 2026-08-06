import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, ErrorCode
from app.models.audit import AuditAction
from app.models.category import Category
from app.models.listing import Listing, ListingStatus
from app.models.user import User
from app.services import audit_service


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


async def list_tree(db: AsyncSession, *, active_only: bool = True) -> list[dict]:
    """Top-level categories with their children and listing counts.

    A parent's count includes its children's, since browsing "Electronics"
    shows everything beneath it — a parent showing 0 while its children
    show 40 would read as a bug.

    `active_only` is the public view. Hiding a parent hides its children with
    it: they are only reachable through the parent in the navigation, so
    leaving them visible would strand them.
    """
    query = (
        select(Category)
        .where(Category.parent_id.is_(None))
        .options(selectinload(Category.children))
        .order_by(Category.sort_order)
    )
    if active_only:
        query = query.where(Category.is_active.is_(True))
    result = await db.execute(query)
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
                "is_active": child.is_active,
            }
            for child in parent.children
            if child.is_active or not active_only
        ]
        tree.append(
            {
                "id": parent.id,
                "name": parent.name,
                "slug": parent.slug,
                "icon": parent.icon,
                # Counted over *every* child, not just the visible ones.
                # Browsing a parent matches all of its descendants (see
                # descendant_ids), so a count that skipped hidden children
                # would promise fewer listings than the page then shows.
                "listing_count": counts.get(parent.id, 0)
                + sum(counts.get(c.id, 0) for c in parent.children),
                "is_active": parent.is_active,
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


async def ensure_exists(
    db: AsyncSession, category_id: uuid.UUID | None, *, current_id: uuid.UUID | None = None
) -> None:
    """Reject an unknown or retired category_id with a 400 before it reaches
    the FK.

    Without this the insert raises ForeignKeyViolationError, which surfaces as
    a 500 — a client sending a bad id is a client error, not a server fault.

    `current_id` is the category the listing is already in. A retired category
    is refused for anything new, but accepted when it is what the listing
    already had: otherwise deactivating a category would make every listing
    inside it uneditable, since saving any other field resubmits the same id.
    """
    if category_id is None:
        return
    row = (
        await db.execute(
            select(Category.id, Category.is_active).where(Category.id == category_id)
        )
    ).one_or_none()
    if row is None:
        raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.UNKNOWN_CATEGORY, "Unknown category")
    if not row.is_active and category_id != current_id:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.UNKNOWN_CATEGORY,
            "That category is no longer available",
        )


async def descendant_ids(db: AsyncSession, category: Category) -> list[uuid.UUID]:
    """The category itself plus its children.

    Only one level deep because the taxonomy is fixed at two levels — if
    that ever changes this needs a recursive CTE, which is exactly why the
    depth limit is documented on the model.
    """
    rows = await db.execute(select(Category.id).where(Category.parent_id == category.id))
    return [category.id, *rows.scalars().all()]


# --- admin management --------------------------------------------------------
#
# Everything below is admin-only. The three rules that shape it:
#
#   1. Deleting a category is dangerous in a way deactivating is not, because
#      `listings.category_id` is ON DELETE SET NULL — a delete silently
#      uncategorises real stock. So a category holding listings cannot be
#      deleted without saying where those listings go.
#   2. `categories.parent_id` is ON DELETE CASCADE, so deleting a parent would
#      take its children — and their listings — with it. Parents with children
#      are refused outright.
#   3. The taxonomy is two levels by design. Every move is checked against
#      that, because a third level would silently break `descendant_ids`,
#      which only looks one level down.


async def get(db: AsyncSession, category_id: uuid.UUID) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return category


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:110] or "category"


async def _unique_slug(db: AsyncSession, base: str, *, exclude: uuid.UUID | None = None) -> str:
    """A slug nobody else is using.

    Two categories may legitimately want the same name under different
    parents — "Accessories" under both Electronics and Fashion — so a
    collision is not an error to push back to the admin.
    """
    slug = _slugify(base)
    query = select(Category.slug).where(Category.slug.like(f"{slug}%"))
    if exclude is not None:
        query = query.where(Category.id != exclude)
    taken = set((await db.execute(query)).scalars().all())
    if slug not in taken:
        return slug
    for n in range(2, 100):
        candidate = f"{slug}-{n}"
        if candidate not in taken:
            return candidate
    return f"{slug}-{uuid.uuid4().hex[:6]}"


async def _has_children(db: AsyncSession, category_id: uuid.UUID) -> bool:
    return (
        await db.execute(select(Category.id).where(Category.parent_id == category_id).limit(1))
    ).scalar_one_or_none() is not None


async def listing_counts(db: AsyncSession, category_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Listings per category, counting *every* listing rather than only the
    active ones.

    The public tree counts what a visitor can browse. This one answers "what
    breaks if I delete this?", and a sold or removed listing still has a
    category to lose.
    """
    if not category_ids:
        return {}
    rows = await db.execute(
        select(Listing.category_id, func.count(Listing.id))
        .where(Listing.category_id.in_(category_ids))
        .group_by(Listing.category_id)
    )
    return {cid: count for cid, count in rows.all()}


async def list_all(db: AsyncSession) -> list[Category]:
    """Every category, hidden ones included, top level before children."""
    return list(
        (
            await db.execute(
                select(Category).order_by(
                    Category.parent_id.nulls_first(), Category.sort_order
                )
            )
        )
        .scalars()
        .unique()
        .all()
    )


async def _validate_parent(
    db: AsyncSession, parent_id: uuid.UUID | None, *, moving: Category | None = None
) -> None:
    """Enforce the two-level limit, from both directions."""
    if parent_id is None:
        return
    if moving is not None and parent_id == moving.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A category cannot be its own parent")
    parent = await db.get(Category, parent_id)
    if parent is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown parent category")
    if parent.parent_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Categories only nest one level deep")
    if moving is not None and await _has_children(db, moving.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Move or remove its subcategories before nesting this one",
        )


async def _next_sort_order(db: AsyncSession, parent_id: uuid.UUID | None) -> int:
    """One past the end of a level.

    `is_(None)` rather than `== None`: comparing a column to NULL with `=`
    is never true in SQL, so the top level would have matched nothing and
    every new top-level category would have been given order 0.
    """
    return (
        await db.execute(
            select(func.coalesce(func.max(Category.sort_order), -1)).where(
                Category.parent_id.is_(None)
                if parent_id is None
                else Category.parent_id == parent_id
            )
        )
    ).scalar_one() + 1


async def create_category(
    db: AsyncSession,
    *,
    name: str,
    icon: str | None,
    parent_id: uuid.UUID | None,
    actor: User,
) -> Category:
    """Add a category at the end of its level, visible straight away.

    Unlike a page section, a new category shows no listings until someone
    files something under it, so there is nothing half-finished for a
    visitor to stumble into.
    """
    await _validate_parent(db, parent_id)

    category = Category(
        name=name.strip(),
        slug=await _unique_slug(db, name),
        icon=icon or None,
        parent_id=parent_id,
        sort_order=await _next_sort_order(db, parent_id),
        is_active=True,
    )
    db.add(category)
    await db.flush()

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.CATEGORY_CREATED,
        target_type="category",
        target_id=category.id,
        target_label=category.name,
        detail={"slug": category.slug, "parent_id": str(parent_id) if parent_id else None},
    )
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    *,
    name: str | None = None,
    slug: str | None = None,
    icon: str | None = None,
    icon_set: bool = False,
    parent_id: uuid.UUID | None = None,
    parent_set: bool = False,
    is_active: bool | None = None,
    actor: User,
) -> Category:
    """Rename, retag, move or hide a category.

    Renaming deliberately leaves the slug alone. The slug is the URL — every
    link to `/listings?category=electronics`, every bookmark, every crawler's
    index — and silently repointing all of it because someone fixed a typo in
    a label would be a surprising cost for a cosmetic change. Changing the URL
    is available, but has to be asked for.
    """
    category = await get(db, category_id)
    changed: dict = {}

    if name is not None and name.strip() and name.strip() != category.name:
        changed["name"] = {"from": category.name, "to": name.strip()}
        category.name = name.strip()

    if slug is not None and slug.strip() and _slugify(slug) != category.slug:
        new_slug = await _unique_slug(db, slug, exclude=category.id)
        changed["slug"] = {"from": category.slug, "to": new_slug}
        category.slug = new_slug

    # `icon_set` distinguishes "leave the icon alone" from "clear the icon",
    # which a bare None cannot express.
    if icon_set and (icon or None) != category.icon:
        changed["icon"] = {"from": category.icon, "to": icon or None}
        category.icon = icon or None

    if parent_set and parent_id != category.parent_id:
        await _validate_parent(db, parent_id, moving=category)
        changed["parent_id"] = {
            "from": str(category.parent_id) if category.parent_id else None,
            "to": str(parent_id) if parent_id else None,
        }
        category.parent_id = parent_id
        # Appended to its new level rather than keeping a position that
        # belonged to a different list of siblings.
        category.sort_order = await _next_sort_order(db, parent_id)

    if is_active is not None and is_active != category.is_active:
        changed["is_active"] = {"from": category.is_active, "to": is_active}
        category.is_active = is_active

    if changed:
        audit_service.record(
            db,
            actor=actor,
            action=AuditAction.CATEGORY_UPDATED,
            target_type="category",
            target_id=category.id,
            target_label=category.name,
            detail=changed,
        )
    await db.commit()
    await db.refresh(category)
    return category


async def reorder_categories(
    db: AsyncSession,
    parent_id: uuid.UUID | None,
    category_ids: list[uuid.UUID],
    *,
    actor: User,
) -> list[Category]:
    """Apply an explicit order to one level.

    Scoped to a single parent — the top level, or one parent's children —
    because those are the only lists ever displayed as an ordered group. As
    with sections and images, the order must name every sibling exactly once:
    a partial list leaves the omitted rows at stale positions and produces
    duplicate sort_orders, after which the level renders in an arbitrary
    order.
    """
    siblings = list(
        (
            await db.execute(
                select(Category).where(
                    Category.parent_id.is_(None)
                    if parent_id is None
                    else Category.parent_id == parent_id
                )
            )
        )
        .scalars()
        .all()
    )
    current = {c.id: c for c in siblings}
    if set(category_ids) != set(current) or len(category_ids) != len(current):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The order must list every category at this level exactly once",
        )

    for index, category_id in enumerate(category_ids):
        current[category_id].sort_order = index

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.CATEGORIES_REORDERED,
        target_type="category",
        target_id=parent_id,
        detail={"order": [current[i].name for i in category_ids]},
    )
    await db.commit()
    return sorted(current.values(), key=lambda c: c.sort_order)


async def delete_category(
    db: AsyncSession,
    category_id: uuid.UUID,
    *,
    move_to_id: uuid.UUID | None = None,
    actor: User,
) -> None:
    """Remove a category, moving any listings it holds somewhere else first.

    Refused outright if it still has subcategories: `parent_id` cascades, so
    the delete would take them and their listings with it. Refused too if it
    holds listings and no destination was named, because the listing FK is
    SET NULL and those listings would come back uncategorised with no record
    of where they had been. Hiding remains the option that costs nothing.
    """
    category = await get(db, category_id)

    if await _has_children(db, category.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Move or delete its subcategories first")

    held = (await listing_counts(db, [category.id])).get(category.id, 0)
    moved_to = None
    if held:
        if move_to_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"{held} listing(s) are in this category - choose where to move them",
            )
        if move_to_id == category.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Listings cannot be moved into the category being deleted",
            )
        moved_to = await get(db, move_to_id)
        await db.execute(
            update(Listing).where(Listing.category_id == category.id).values(category_id=moved_to.id)
        )

    audit_service.record(
        db,
        actor=actor,
        action=AuditAction.CATEGORY_DELETED,
        target_type="category",
        target_id=category.id,
        target_label=category.name,
        detail={
            "slug": category.slug,
            "listings_moved": held,
            "moved_to": moved_to.name if moved_to else None,
        },
    )
    await db.delete(category)
    await db.commit()
