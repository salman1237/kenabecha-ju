import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class PublicRaterOut(BaseModel):
    """Deliberately narrower than ListingSellerOut — a landing-page
    testimonial needs a name and face, not the reviewer's phone number."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr


class PublicStatsOut(BaseModel):
    """Headline numbers for the landing page's statistics band. Deliberately
    a different shape from AdminStatsOut — no pending_reports or anything
    else operational, only figures that are safe and meaningful publicly."""

    total_users: int
    total_shops: int
    total_active_listings: int
    total_ratings: int


class PublicReviewOut(BaseModel):
    """A recent written review, flattened with the name of whoever it was
    left for, so the landing page doesn't need a second lookup per row."""

    id: uuid.UUID
    stars: int
    review_text: str
    created_at: datetime
    rater: PublicRaterOut
    target_name: str
    target_url: str
    listing_title: str
