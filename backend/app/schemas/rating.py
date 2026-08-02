import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.listing import ListingSellerOut


class RatingCreate(BaseModel):
    stars: int = Field(ge=1, le=5)
    review_text: str | None = Field(default=None, max_length=1000)


class RatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    listing_id: uuid.UUID
    stars: int
    review_text: str | None
    created_at: datetime
    rater: ListingSellerOut


class RatingSummary(BaseModel):
    average_rating: float | None
    rating_count: int


class RatingEligibility(BaseModel):
    can_rate: bool
    reason: str | None
