import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.shop import ShopCreate, ShopOut, ShopUpdate
from app.services import rating_service, shop_service

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
    payload: ShopCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> ShopOut:
    shop = await shop_service.create_shop(db, user, payload)
    return _to_out(shop)


@router.get("/mine", response_model=list[ShopOut])
async def list_my_shops(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[ShopOut]:
    shops = await shop_service.list_my_shops(db, user.id)
    result = []
    for shop, count in shops:
        avg, rcount = await rating_service.get_shop_rating_summary(db, shop.id)
        result.append(_to_out(shop, count, avg, rcount))
    return result


@router.get("/{slug}", response_model=ShopOut)
async def get_shop(slug: str, db: AsyncSession = Depends(get_db)) -> ShopOut:
    shop, count = await shop_service.get_shop_by_slug(db, slug)
    avg, rcount = await rating_service.get_shop_rating_summary(db, shop.id)
    return _to_out(shop, count, avg, rcount)


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


@router.delete("/{shop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shop(
    shop_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    shop = await shop_service.get_owned_shop(db, shop_id, user)
    await shop_service.delete_shop(db, shop)
