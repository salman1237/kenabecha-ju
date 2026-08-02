import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.rating import RatingCreate, RatingEligibility, RatingOut
from app.services import listing_service, rating_service

router = APIRouter(prefix="/listings/{listing_id}", tags=["ratings"])


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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RatingOut:
    listing = await listing_service.get_listing(db, listing_id)
    rating = await rating_service.create_rating(db, listing, user, payload)
    return RatingOut.model_validate(rating)
