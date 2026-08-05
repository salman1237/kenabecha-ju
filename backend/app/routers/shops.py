import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_optional_user, get_seller
from app.db.session import get_db
from app.models.shop import Shop
from app.models.user import User
from app.schemas.rating import RatingOut
from app.schemas.shop import ShopCreate, ShopOut, ShopStatsOut, ShopUpdate
from app.services import media_service, rating_service, shop_service

router = APIRouter(prefix="/shops", tags=["shops"])


def _to_out(
    shop, listing_count: int = 0, average_rating: float | None = None, rating_count: int = 0
) -> ShopOut:
    return ShopOut.model_validate(shop, from_attributes=True).model_copy(
        update={
            "listing_count": listing_count,
            "average_rating": average_rating,
            "rating_count": rating_count,
        }
    )


@router.post("", response_model=ShopOut, status_code=status.HTTP_201_CREATED)
async def create_shop(
    payload: ShopCreate, user: User = Depends(get_seller), db: AsyncSession = Depends(get_db)
) -> ShopOut:
    shop = await shop_service.create_shop(db, user, payload)
    return _to_out(shop)


@router.get("", response_model=list[ShopOut])
async def list_shops(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)) -> list[ShopOut]:
    shops = await shop_service.list_shops(db, skip, limit)
    result = []
    shop_ids = [shop.id for shop, _ in shops]
    ratings = await rating_service.get_shops_rating_summaries(db, shop_ids)
    for shop, count in shops:
        avg, rcount = ratings.get(shop.id, (None, 0))
        result.append(_to_out(shop, count, avg, rcount))
    return result


@router.get("/mine", response_model=list[ShopOut])
async def list_my_shops(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ShopOut]:
    shops = await shop_service.list_my_shops(db, user.id)
    result = []
    shop_ids = [shop.id for shop, _ in shops]
    ratings = await rating_service.get_shops_rating_summaries(db, shop_ids)
    for shop, count in shops:
        avg, rcount = ratings.get(shop.id, (None, 0))
        result.append(_to_out(shop, count, avg, rcount))
    return result


@router.get("/{slug}", response_model=ShopOut)
async def get_shop(slug: str, db: AsyncSession = Depends(get_db)) -> ShopOut:
    shop, count = await shop_service.get_shop_by_slug(db, slug)
    avg, rcount = await rating_service.get_shop_rating_summary(db, shop.id)
    return _to_out(shop, count, avg, rcount)


@router.get("/{slug}/stats", response_model=ShopStatsOut)
async def get_shop_stats(
    slug: str,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ShopStatsOut:
    shop, _ = await shop_service.get_shop_by_slug(db, slug)
    stats = await shop_service.get_shop_stats(db, shop)
    avg, _count = await rating_service.get_shop_rating_summary(db, shop.id)

    return ShopStatsOut(
        **stats,
        average_rating=avg,
        # None (not False) when anonymous, so the UI can prompt a login
        # rather than render a misleading "Following" state.
        is_following=(await shop_service.is_following(db, user.id, shop.id)) if user else None,
    )


@router.post("/{shop_id}/follow", response_model=dict)
async def toggle_follow(
    shop_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    shop = await db.get(Shop, shop_id)
    if shop is None or not shop.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shop not found")
    following = await shop_service.toggle_follow(db, user, shop)
    return {"following": following}


@router.get("/{slug}/reviews", response_model=list[RatingOut])
async def get_shop_reviews(slug: str, db: AsyncSession = Depends(get_db)) -> list[RatingOut]:
    shop, _ = await shop_service.get_shop_by_slug(db, slug)
    reviews = await rating_service.list_shop_ratings(db, shop.id)
    return [RatingOut.model_validate(r) for r in reviews]


@router.patch("/{shop_id}", response_model=ShopOut)
async def update_shop(
    shop_id: uuid.UUID,
    payload: ShopUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShopOut:
    shop = await shop_service.get_owned_shop(db, shop_id, user)
    shop = await shop_service.update_shop(db, shop, payload)
    return _to_out(shop)


@router.post("/{shop_id}/logo", response_model=ShopOut)
async def upload_shop_logo(
    shop_id: uuid.UUID,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShopOut:
    shop = await shop_service.get_owned_shop(db, shop_id, user)
    image_url = await media_service.save_image(file, "shops")
    shop = await shop_service.set_logo(db, shop, image_url)
    return _to_out(shop)


@router.post("/{shop_id}/cover", response_model=ShopOut)
async def upload_shop_cover(
    shop_id: uuid.UUID,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShopOut:
    shop = await shop_service.get_owned_shop(db, shop_id, user)
    image_url = await media_service.save_image(file, "shops")
    shop = await shop_service.set_cover(db, shop, image_url)
    return _to_out(shop)


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shop(
    shop_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    shop = await shop_service.get_owned_shop(db, shop_id, user)
    await shop_service.delete_shop(db, shop)
