import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import (
    get_current_admin,
    get_current_user,
    get_optional_user,
    get_seller,
)
from app.core.rate_limit import client_identifier
from app.db.session import get_db
from app.models.listing import Condition
from app.models.shop import Shop
from app.models.user import User
from app.schemas.common import Page
from app.schemas.listing import (
    ListingCreate,
    ListingFeatureIn,
    ListingImageOut,
    ListingOut,
    ListingUpdate,
)
from app.schemas.rating import RatingOut, SellerReviewsOut
from app.services import listing_service, media_service, rating_service

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
    is_top: bool | None = None,
    category_id: uuid.UUID | None = None,
    category: str | None = Query(default=None, description="Category slug; includes subcategories"),
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
        is_top=is_top,
        category_id=category_id,
        category_slug=category,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    items, total = await listing_service.browse_listings(db, filters)
    return Page(
        items=[ListingOut.model_validate(i) for i in items], total=total, limit=filters.limit, offset=offset
    )


@router.get("/suggestions", response_model=list[str])
async def get_search_suggestions(
    q: str = Query(..., min_length=2),
    limit: int = Query(default=5, le=10),
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Returns a list of search suggestions for the given query."""
    return await listing_service.get_search_suggestions(db, q, limit)


@router.get("/mine", response_model=list[ListingOut])
async def list_my_listings(
    shop_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ListingOut]:
    listings = await listing_service.list_my_listings(db, user.id, shop_id)
    return [ListingOut.model_validate(i) for i in listings]


@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(
    listing_id: uuid.UUID,
    request: Request,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ListingOut:
    listing = await listing_service.get_listing(db, listing_id)
    # Only the detail route counts. /related and /seller-reviews also load a
    # listing, and counting those would inflate the number with traffic the
    # seller never actually received.
    await listing_service.record_view(
        db,
        listing,
        viewer,
        client_identifier(request),
        request.headers.get("user-agent"),
    )
    return ListingOut.model_validate(listing)


@router.get("/{listing_id}/related", response_model=list[ListingOut])
async def get_related_listings(
    listing_id: uuid.UUID,
    limit: int = Query(default=8, le=24),
    db: AsyncSession = Depends(get_db),
) -> list[ListingOut]:
    listing = await listing_service.get_listing(db, listing_id)
    related = await listing_service.list_related_listings(db, listing, limit)
    return [ListingOut.model_validate(i) for i in related]


@router.get("/{listing_id}/seller-reviews", response_model=SellerReviewsOut)
async def get_seller_reviews(listing_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> SellerReviewsOut:
    """Reviews for whoever is selling this listing — the shop if it's a shop
    listing, otherwise the individual seller. Same split the rating system
    itself uses when deciding what a rating targets."""
    listing = await listing_service.get_listing(db, listing_id)

    if listing.shop_id is not None:
        shop = await db.get(Shop, listing.shop_id)
        average, count = await rating_service.get_shop_rating_summary(db, shop.id)
        breakdown = await rating_service.get_star_breakdown(db, shop_id=shop.id)
        reviews = await rating_service.list_shop_ratings(db, shop.id)
        target_type, target_name, target_url = "shop", shop.shop_name, f"/shops/{shop.slug}"
    else:
        seller = listing.seller
        average, count = await rating_service.get_user_rating_summary(db, seller.id)
        breakdown = await rating_service.get_star_breakdown(db, user_id=seller.id)
        reviews = await rating_service.list_user_ratings(db, seller.id)
        target_type, target_name, target_url = "user", seller.full_name, f"/profile/{seller.id}"

    return SellerReviewsOut(
        target_type=target_type,
        target_name=target_name,
        target_url=target_url,
        average_rating=average,
        rating_count=count,
        breakdown=breakdown,
        reviews=[RatingOut.model_validate(r) for r in reviews],
    )


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


@router.post("/{listing_id}/renew", response_model=ListingOut)
async def renew_listing(
    listing_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ListingOut:
    # get_owned_listing, not get_listing: an expired listing is still is_active
    # and not soft-deleted, so its owner can reach and revive it.
    listing = await listing_service.get_owned_listing(db, listing_id, user)
    listing = await listing_service.renew_listing(db, listing)
    return ListingOut.model_validate(listing)


@router.post("/{listing_id}/feature", response_model=ListingOut)
async def feature_listing(
    listing_id: uuid.UUID,
    payload: ListingFeatureIn,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> ListingOut:
    """Admin-only. Promotion is granted, not bought — there's no payment
    integration, so letting sellers set this themselves would just mean
    everyone is featured and the ordering means nothing."""
    listing = await listing_service.get_listing(db, listing_id)
    listing = await listing_service.set_featured(db, listing, payload.days)
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
