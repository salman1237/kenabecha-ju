import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, func, insert, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import (
    Condition,
    FulfillmentType,
    Listing,
    ListingImage,
    ListingStatus,
    ListingView,
    Tag,
    listing_tags,
)
from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.search import LIKE_ESCAPE, like_contains
from app.models.user import User
from app.schemas.listing import OFFERS_PICKUP, ListingCreate, ListingUpdate
from app.services import category_service, shop_service, tag_service

MAX_IMAGES_PER_LISTING = 8

# How long a new listing stays up before it needs renewing. Student listings
# go stale fast — a term's worth of dead "still available?" threads is the
# thing this is meant to prevent.
LISTING_TTL_DAYS = 30


async def _attach_tags(db: AsyncSession, listing: Listing, tag_names: list[str], *, replace: bool) -> None:
    """Writes directly to the listing_tags association table rather than through the
    ORM `listing.tags` collection, since assigning that collection on an already-flushed
    listing forces a synchronous lazy-load to diff it, which fails under async SQLAlchemy."""
    if replace:
        old_tags_result = await db.execute(
            select(Tag).join(listing_tags, Tag.id == listing_tags.c.tag_id).where(listing_tags.c.listing_id == listing.id)
        )
        old_tags = old_tags_result.scalars().all()
        for old_tag in old_tags:
            old_tag.usage_count = max(0, old_tag.usage_count - 1)

        await db.execute(delete(listing_tags).where(listing_tags.c.listing_id == listing.id))

    tags = await tag_service.get_or_create_tags(db, tag_names)
    for tag in tags:
        tag.usage_count += 1
    await db.flush()  # ensure new tags have ids

    if tags:
        await db.execute(
            insert(listing_tags),
            [{"listing_id": listing.id, "tag_id": tag.id} for tag in tags],
        )


async def create_listing(db: AsyncSession, seller: User, payload: ListingCreate) -> Listing:
    if payload.shop_id is not None:
        await shop_service.get_owned_shop(db, payload.shop_id, seller)
        condition = Condition.new
        quantity = payload.quantity if payload.quantity is not None else 1
    else:
        condition = payload.condition
        quantity = 1

    await category_service.ensure_exists(db, payload.category_id)

    listing = Listing(
        seller_id=seller.id,
        shop_id=payload.shop_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        price_type=payload.price_type,
        unit=payload.unit,
        condition=condition,
        quantity=quantity,
        fulfillment_type=payload.fulfillment_type,
        pickup_address=payload.pickup_address,
        expires_at=datetime.now(UTC) + timedelta(days=LISTING_TTL_DAYS),
    )
    db.add(listing)
    await db.flush()

    await _attach_tags(db, listing, payload.tags, replace=False)

    await db.commit()
    await db.refresh(listing)
    return listing


async def get_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = await db.get(Listing, listing_id)
    # Check both halves of the soft-delete. delete_listing() sets them
    # together today, so is_active is belt-and-braces — but any future path
    # that deactivates without stamping deleted_at would otherwise leave the
    # listing publicly reachable.
    if listing is None or listing.deleted_at is not None or not listing.is_active:
        raise AppError(status.HTTP_404_NOT_FOUND, ErrorCode.LISTING_NOT_FOUND, "Listing not found")
    return listing


async def get_owned_listing(db: AsyncSession, listing_id: uuid.UUID, seller: User) -> Listing:
    listing = await get_listing(db, listing_id)
    if listing.seller_id != seller.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't own this listing")
    return listing


class BrowseFilters:
    def __init__(
        self,
        q: str | None = None,
        tags: list[str] | None = None,
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
        condition: Condition | None = None,
        shop_id: uuid.UUID | None = None,
        seller_id: uuid.UUID | None = None,
        personal_only: bool = False,
        is_top: bool | None = None,
        category_id: uuid.UUID | None = None,
        category_slug: str | None = None,
        sort: str = "newest",
        limit: int = 20,
        offset: int = 0,
    ) -> None:
        self.q = q
        self.tags = tags or []
        self.min_price = min_price
        self.max_price = max_price
        self.condition = condition
        self.shop_id = shop_id
        self.seller_id = seller_id
        self.personal_only = personal_only
        self.is_top = is_top
        self.category_id = category_id
        self.category_slug = category_slug
        self.sort = sort
        self.limit = min(limit, 100)
        self.offset = offset


async def browse_listings(db: AsyncSession, filters: BrowseFilters) -> tuple[list[Listing], int]:
    query = (
        select(Listing)
        .join(User, Listing.seller_id == User.id)
        .where(
            Listing.status == ListingStatus.active,
            Listing.deleted_at.is_(None),
            Listing.is_active.is_(True),
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            # Belt-and-braces with the expiry sweep: this keeps browse correct
            # in the window between a listing lapsing and the sweep running,
            # and if the sweep task ever dies.
            or_(Listing.expires_at.is_(None), Listing.expires_at > func.now()),
        )
    )

    if filters.is_top is not None:
        query = query.where(Listing.is_top == filters.is_top)

    if filters.q:
        like = like_contains(filters.q)
        query = query.where(
            Listing.title.ilike(like, escape=LIKE_ESCAPE)
            | Listing.description.ilike(like, escape=LIKE_ESCAPE)
        )
    if filters.tags:
        normalized = [t.strip().lower() for t in filters.tags]
        query = query.where(
            Listing.id.in_(
                select(listing_tags.c.listing_id)
                .join(Tag, Tag.id == listing_tags.c.tag_id)
                .where(Tag.normalized_name.in_(normalized))
            )
        )
    if filters.min_price is not None:
        query = query.where(Listing.price >= filters.min_price)
    if filters.max_price is not None:
        query = query.where(Listing.price <= filters.max_price)
    if filters.condition is not None:
        query = query.where(Listing.condition == filters.condition)
    if filters.shop_id is not None:
        query = query.where(Listing.shop_id == filters.shop_id)
    if filters.seller_id is not None:
        query = query.where(Listing.seller_id == filters.seller_id)
    if filters.personal_only:
        query = query.where(Listing.shop_id.is_(None))

    # Category filter: resolve slug to IDs if needed, then filter
    if filters.category_slug:
        cat = await category_service.get_by_slug(db, filters.category_slug)
        cat_ids = await category_service.descendant_ids(db, cat)
        query = query.where(Listing.category_id.in_(cat_ids))
    elif filters.category_id:
        query = query.where(Listing.category_id == filters.category_id)

    count_query = select(func.count()).select_from(query.with_only_columns(Listing.id).subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Live promotions float to the top of every ordering. Expressed as a
    # sort key rather than a separate query so paging stays correct — a
    # prepended list would repeat featured items on every page.
    featured_first = (
        Listing.featured_until.is_not(None) & (Listing.featured_until > func.now())
    ).desc()

    if filters.sort == "price_asc":
        query = query.order_by(featured_first, Listing.price.asc().nulls_last())
    elif filters.sort == "price_desc":
        query = query.order_by(featured_first, Listing.price.desc().nulls_last())
    elif filters.sort == "popular":
        query = query.order_by(featured_first, Listing.view_count.desc(), Listing.created_at.desc())
    else:
        query = query.order_by(featured_first, Listing.created_at.desc())

    query = query.limit(filters.limit).offset(filters.offset)
    items = list((await db.execute(query)).scalars().unique().all())
    return items, total


async def list_related_listings(db: AsyncSession, listing: Listing, limit: int = 8) -> list[Listing]:
    """Other listings a viewer of `listing` might also want, ranked by how
    related they are: same shop first, then shared tags, then anything else
    recent. Falls through the tiers until it has `limit` items, so a listing
    with no tags and no shop still gets a useful rail instead of nothing."""
    base = select(Listing).where(
        Listing.id != listing.id,
        Listing.status == ListingStatus.active,
        Listing.deleted_at.is_(None),
    )

    collected: list[Listing] = []
    seen: set[uuid.UUID] = {listing.id}

    def take(candidates: list[Listing]) -> None:
        for c in candidates:
            if c.id not in seen and len(collected) < limit:
                seen.add(c.id)
                collected.append(c)

    if listing.shop_id is not None:
        rows = await db.execute(
            base.where(Listing.shop_id == listing.shop_id).order_by(Listing.created_at.desc()).limit(limit)
        )
        take(list(rows.scalars().unique().all()))

    if len(collected) < limit:
        tag_ids = [t.id for t in listing.tags]
        if tag_ids:
            rows = await db.execute(
                base.where(
                    Listing.id.in_(select(listing_tags.c.listing_id).where(listing_tags.c.tag_id.in_(tag_ids)))
                )
                .order_by(Listing.created_at.desc())
                .limit(limit)
            )
            take(list(rows.scalars().unique().all()))

    if len(collected) < limit:
        rows = await db.execute(base.order_by(Listing.created_at.desc()).limit(limit))
        take(list(rows.scalars().unique().all()))

    return collected


async def list_my_listings(db: AsyncSession, seller_id: uuid.UUID, shop_id: uuid.UUID | None = None) -> list[Listing]:
    query = select(Listing).where(Listing.seller_id == seller_id, Listing.deleted_at.is_(None))
    if shop_id is not None:
        query = query.where(Listing.shop_id == shop_id)
    else:
        query = query.where(Listing.shop_id.is_(None))
    query = query.order_by(Listing.created_at.desc())
    return list((await db.execute(query)).scalars().unique().all())


async def update_listing(db: AsyncSession, listing: Listing, payload: ListingUpdate) -> Listing:
    data = payload.model_dump(exclude_unset=True, exclude={"tags"})
    if "category_id" in data:
        await category_service.ensure_exists(
            db, data["category_id"], current_id=listing.category_id
        )
    for field, value in data.items():
        setattr(listing, field, value)

    # Validated against the merged state rather than the payload: a partial
    # update may change only one of the two fields.
    if listing.fulfillment_type == FulfillmentType.delivery:
        listing.pickup_address = None
    elif listing.fulfillment_type in OFFERS_PICKUP and not listing.pickup_address:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Pickup address is required when pickup is offered"
        )

    if listing.shop_id is not None:
        listing.condition = Condition.new
        if "quantity" in data:
            if listing.quantity == 0 and listing.status == ListingStatus.active:
                listing.status = ListingStatus.out_of_stock
            elif listing.quantity > 0 and listing.status == ListingStatus.out_of_stock:
                listing.status = ListingStatus.active

    if payload.tags is not None:
        await _attach_tags(db, listing, payload.tags, replace=True)

    await db.commit()
    await db.refresh(listing)
    return listing


def _viewer_key(user: User | None, ip: str | None, user_agent: str | None) -> str:
    """Stable per-viewer identifier. Signed-in viewers key on their user id;
    anonymous ones on a salted hash of IP + user-agent, salted so the table
    can't be used to confirm that a given IP viewed a given listing."""
    if user is not None:
        return f"u:{user.id}"
    raw = f"{ip or ''}|{user_agent or ''}|{get_settings().JWT_SECRET_KEY}"
    return "a:" + hashlib.sha256(raw.encode()).hexdigest()[:60]


async def record_view(
    db: AsyncSession,
    listing: Listing,
    viewer: User | None,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Count one view, at most once per viewer per day.

    A seller looking at their own listing is not a view — otherwise the
    number a seller is shown is partly their own traffic.
    """
    if viewer is not None and viewer.id == listing.seller_id:
        return

    now = datetime.now(UTC)
    window_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    key = _viewer_key(viewer, ip, user_agent)

    # ON CONFLICT DO NOTHING makes the de-duplication atomic. A check-then-
    # insert would double-count under the concurrent requests that a single
    # page load can produce, and the app runs 4 uvicorn workers in prod.
    result = await db.execute(
        pg_insert(ListingView)
        .values(listing_id=listing.id, viewer_key=key, window_start=window_start)
        .on_conflict_do_nothing(constraint="uq_listing_view_window")
    )
    if result.rowcount:
        # Increment in SQL rather than via the loaded object, so simultaneous
        # views don't overwrite each other's counter with a stale value.
        await db.execute(
            update(Listing).where(Listing.id == listing.id).values(view_count=Listing.view_count + 1)
        )
    await db.commit()


async def renew_listing(db: AsyncSession, listing: Listing) -> Listing:
    """Push the expiry out and bring an expired listing back."""
    if listing.status not in (ListingStatus.active, ListingStatus.expired):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only active or expired listings can be renewed"
        )
    listing.expires_at = datetime.now(UTC) + timedelta(days=LISTING_TTL_DAYS)
    listing.status = ListingStatus.active
    await db.commit()
    await db.refresh(listing)
    return listing


async def set_featured(db: AsyncSession, listing: Listing, days: int | None) -> Listing:
    """Promote for `days`, or clear the promotion when days is None."""
    listing.featured_until = (
        None if days is None else datetime.now(UTC) + timedelta(days=days)
    )
    await db.commit()
    await db.refresh(listing)
    return listing


async def expire_stale_listings(db: AsyncSession) -> int:
    """Flip past-deadline active listings to `expired`. Returns how many."""
    result = await db.execute(
        update(Listing)
        .where(
            Listing.status == ListingStatus.active,
            Listing.expires_at.is_not(None),
            Listing.expires_at <= datetime.now(UTC),
        )
        .values(status=ListingStatus.expired)
    )
    await db.commit()
    return result.rowcount or 0


async def mark_sold(db: AsyncSession, listing: Listing) -> Listing:
    if listing.status != ListingStatus.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only active listings can be marked sold")
    listing.status = ListingStatus.sold
    await db.commit()
    await db.refresh(listing)
    return listing


async def delete_listing(db: AsyncSession, listing: Listing) -> None:
    listing.status = ListingStatus.removed
    listing.is_active = False
    listing.deleted_at = datetime.now(UTC)
    await db.commit()


async def add_image(db: AsyncSession, listing: Listing, image_url: str) -> ListingImage:
    if len(listing.images) >= MAX_IMAGES_PER_LISTING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"A listing can have at most {MAX_IMAGES_PER_LISTING} images"
        )
    next_sort_order = len(listing.images)
    image = ListingImage(listing_id=listing.id, image_url=image_url, sort_order=next_sort_order)
    db.add(image)
    await db.commit()
    await db.refresh(listing)
    return image


async def delete_image(db: AsyncSession, listing: Listing, image_id: uuid.UUID) -> None:
    image = next((img for img in listing.images if img.id == image_id), None)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    await db.delete(image)
    
    remaining_images = [img for img in listing.images if img.id != image_id]
    remaining_images.sort(key=lambda img: img.sort_order)
    for i, img in enumerate(remaining_images):
        img.sort_order = i

    await db.commit()


async def reorder_images(
    db: AsyncSession, listing: Listing, image_ids: list[uuid.UUID]
) -> Listing:
    """Apply an explicit image order.

    The first image is the listing's cover everywhere it appears, so being
    able to choose it is the point of this endpoint — not cosmetic ordering.

    The supplied ids must be exactly the listing's current images: accepting
    a partial list would silently leave the omitted ones at stale positions
    and produce duplicate sort_orders.
    """
    current = {img.id for img in listing.images}
    if set(image_ids) != current or len(image_ids) != len(current):
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.NOT_FOUND,
            "The image order must list every image on this listing exactly once",
        )

    positions = {image_id: index for index, image_id in enumerate(image_ids)}
    for img in listing.images:
        img.sort_order = positions[img.id]

    await db.commit()
    await db.refresh(listing)
    return listing


async def get_search_suggestions(db: AsyncSession, q: str, limit: int = 5) -> list[str]:
    """Returns a list of matching titles for active listings."""
    if not q or len(q) < 2:
        return []
        
    stmt = (
        select(Listing.title)
        .join(User, Listing.seller_id == User.id)
        .where(
            Listing.is_active.is_(True),
            Listing.deleted_at.is_(None),
            # Without this, suggestions offer sold and removed listings — the
            # user picks one, searches it, and browse (which does filter on
            # status) returns nothing.
            Listing.status == ListingStatus.active,
            User.is_active.is_(True),
            Listing.title.ilike(like_contains(q), escape=LIKE_ESCAPE),
        )
        .order_by(Listing.created_at.desc())
        # Over-fetch: duplicate titles are common (several sellers listing the
        # same textbook), and de-duplicating a limit-N result would return
        # fewer than N suggestions.
        .limit(limit * 5)
    )

    result = await db.execute(stmt)
    # dict preserves insertion order, so this is an ordered set.
    titles = list(dict.fromkeys(result.scalars().all()))
    return titles[:limit]
