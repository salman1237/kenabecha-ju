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


class SellerReviewsOut(BaseModel):
    """Everything the listing detail page's Reviews tab needs about whoever
    is selling: who they are, their aggregate score, the 5→1 star spread,
    and the most recent written reviews."""

    target_type: str  # "shop" | "user"
    target_name: str
    target_url: str
    average_rating: float | None
    rating_count: int
    breakdown: dict[int, int]
    reviews: list[RatingOut]


class RatingEligibility(BaseModel):
    can_rate: bool
    reason: str | None
