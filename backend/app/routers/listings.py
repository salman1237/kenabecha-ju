import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_seller
from app.db.session import get_db
from app.models.listing import Condition
from app.models.user import User
from app.schemas.common import Page
from app.schemas.listing import ListingCreate, ListingImageOut, ListingOut, ListingUpdate
from app.services import listing_service, media_service

router = APIRouter(prefix="/listings", tags=["listings"])


@router.post("", response_model=ListingOut, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: ListingCreate, user: User = Depends(get_seller), db: AsyncSession = Depends(get_db)
) -> ListingOut:
    listing = await listing_service.create_listing(db, user, payload)
    return ListingOut.model_validate(listing)


@router.get("", response_model=Page[ListingOut])
async def browse_listings(
    q: str | None = None,
    tags: list[str] = Query(default=[]),
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    condition: Condition | None = None,
    shop_id: uuid.UUID | None = None,
    seller_id: uuid.UUID | None = None,
    personal_only: bool = False,
    sort: str = "newest",
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> Page[ListingOut]:
    filters = listing_service.BrowseFilters(
        q=q,
        tags=tags,
        min_price=min_price,
        max_price=max_price,
        condition=condition,
        shop_id=shop_id,
        seller_id=seller_id,
        personal_only=personal_only,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    items, total = await listing_service.browse_listings(db, filters)
    return Page(
        items=[ListingOut.model_validate(i) for i in items], total=total, limit=filters.limit, offset=offset
    )


@router.get("/mine", response_model=list[ListingOut])
async def list_my_listings(
    shop_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ListingOut]:
    listings = await listing_service.list_my_listings(db, user.id, shop_id)
    return [ListingOut.model_validate(i) for i in listings]


@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(listing_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ListingOut:
    listing = await listing_service.get_listing(db, listing_id)
    return ListingOut.model_validate(listing)


@router.patch("/{listing_id}", response_model=ListingOut)
async def update_listing(
    listing_id: uuid.UUID,
    payload: ListingUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ListingOut:
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    listing = await listing_service.update_listing(db, listing, payload)
    return ListingOut.model_validate(listing)


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    await listing_service.delete_listing(db, listing)


@router.post("/{listing_id}/mark-sold", response_model=ListingOut)
async def mark_sold(
    listing_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ListingOut:
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    listing = await listing_service.mark_sold(db, listing)
    return ListingOut.model_validate(listing)


@router.post("/{listing_id}/images", response_model=ListingImageOut, status_code=status.HTTP_201_CREATED)
async def upload_listing_image(
    listing_id: uuid.UUID,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ListingImageOut:
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    image_url = await media_service.save_image(file, "listings")
    image = await listing_service.add_image(db, listing, image_url)
    return ListingImageOut.model_validate(image)


@router.delete("/{listing_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing_image(
    listing_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    await listing_service.delete_image(db, listing, image_id)
