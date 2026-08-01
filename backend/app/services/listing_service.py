import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Condition, Listing, ListingImage, ListingStatus, Tag, listing_tags
from app.models.user import User
from app.schemas.listing import ListingCreate, ListingUpdate
from app.services import shop_service, tag_service

MAX_IMAGES_PER_LISTING = 8


async def _attach_tags(db: AsyncSession, listing: Listing, tag_names: list[str], *, replace: bool) -> None:
    """Writes directly to the listing_tags association table rather than through the
    ORM `listing.tags` collection, since assigning that collection on an already-flushed
    listing forces a synchronous lazy-load to diff it, which fails under async SQLAlchemy."""
    tags = await tag_service.get_or_create_tags(db, tag_names)
    for tag in tags:
        tag.usage_count += 1
    await db.flush()  # ensure new tags have ids

    if replace:
        await db.execute(delete(listing_tags).where(listing_tags.c.listing_id == listing.id))

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

    listing = Listing(
        seller_id=seller.id,
        shop_id=payload.shop_id,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        price_type=payload.price_type,
        condition=condition,
        quantity=quantity,
    )
    db.add(listing)
    await db.flush()

    await _attach_tags(db, listing, payload.tags, replace=False)

    await db.commit()
    await db.refresh(listing)
    return listing


async def get_listing(db: AsyncSession, listing_id: uuid.UUID) -> Listing:
    listing = await db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Listing not found")
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
        self.sort = sort
        self.limit = min(limit, 100)
        self.offset = offset


async def browse_listings(db: AsyncSession, filters: BrowseFilters) -> tuple[list[Listing], int]:
    query = select(Listing).where(Listing.status == ListingStatus.active, Listing.deleted_at.is_(None))

    if filters.q:
        like = f"%{filters.q}%"
        query = query.where((Listing.title.ilike(like)) | (Listing.description.ilike(like)))
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

    count_query = select(func.count()).select_from(query.with_only_columns(Listing.id).subquery())
    total = (await db.execute(count_query)).scalar_one()

    if filters.sort == "price_asc":
        query = query.order_by(Listing.price.asc().nulls_last())
    elif filters.sort == "price_desc":
        query = query.order_by(Listing.price.desc().nulls_last())
    else:
        query = query.order_by(Listing.created_at.desc())

    query = query.limit(filters.limit).offset(filters.offset)
    items = list((await db.execute(query)).scalars().unique().all())
    return items, total


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
    for field, value in data.items():
        setattr(listing, field, value)

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
    await db.commit()
