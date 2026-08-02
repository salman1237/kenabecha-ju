import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.notification import NotificationType
from app.models.rating import RatingTargetType
from app.models.shop import Shop
from app.models.user import User
from app.schemas.rating import RatingCreate, RatingEligibility, RatingOut
from app.services import listing_service, notification_service, rating_service

router = APIRouter(prefix="/listings/{listing_id}", tags=["ratings"])
settings = get_settings()


@router.get("/rating-eligibility", response_model=RatingEligibility)
async def get_rating_eligibility(
    listing_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> RatingEligibility:
    listing = await listing_service.get_listing(db, listing_id)
    can_rate, reason = await rating_service.check_eligibility(db, listing, user)
    return RatingEligibility(can_rate=can_rate, reason=reason)


@router.post("/ratings", response_model=RatingOut, status_code=status.HTTP_201_CREATED)
async def create_rating(
    listing_id: uuid.UUID,
    payload: RatingCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RatingOut:
    listing = await listing_service.get_listing(db, listing_id)
    rating = await rating_service.create_rating(db, listing, user, payload)

    stars_display = "★" * rating.stars
    if rating.target_type == RatingTargetType.shop:
        shop = await db.get(Shop, rating.target_shop_id)
        owner_id = shop.owner_id
        link_url = f"/shops/{shop.slug}"
    else:
        owner_id = rating.target_user_id
        link_url = f"/profile/{owner_id}"

    await notification_service.notify(
        db,
        background_tasks,
        owner_id,
        NotificationType.new_rating,
        title=f"New {rating.stars}-star rating ({stars_display})",
        body=rating.review_text,
        link_url=link_url,
        email_subject="You received a new rating on KenaBecha JU",
        email_body=(
            f"{user.full_name} left you a {rating.stars}-star rating for \"{listing.title}\".\n\n"
            + (f'"{rating.review_text}"\n\n' if rating.review_text else "")
            + f"View it at: {settings.FRONTEND_URL}{link_url}"
        ),
    )

    return RatingOut.model_validate(rating)
