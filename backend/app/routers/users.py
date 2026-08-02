import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.rating import RatingOut
from app.schemas.shop import ShopOut
from app.schemas.user import UserProfileOut
from app.services import rating_service, shop_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserProfileOut)
async def get_user_profile(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> UserProfileOut:
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    average_rating, rating_count = await rating_service.get_user_rating_summary(db, user.id)
    recent_ratings = await rating_service.list_user_ratings(db, user.id)
    shops = await shop_service.list_my_shops(db, user.id)

    shop_outs = []
    for shop, listing_count in shops:
        shop_avg, shop_rating_count = await rating_service.get_shop_rating_summary(db, shop.id)
        shop_outs.append(
            ShopOut.model_validate(shop, from_attributes=True).model_copy(
                update={
                    "listing_count": listing_count,
                    "average_rating": shop_avg,
                    "rating_count": shop_rating_count,
                }
            )
        )

    return UserProfileOut(
        id=user.id,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        department=user.department,
        batch=user.batch,
        created_at=user.created_at,
        average_rating=average_rating,
        rating_count=rating_count,
        recent_ratings=[RatingOut.model_validate(r) for r in recent_ratings],
        shops=shop_outs,
    )
