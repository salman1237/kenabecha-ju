import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ShopCreate(BaseModel):
    shop_name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    shop_type: str | None = Field(default=None, max_length=100)


class ShopUpdate(BaseModel):
    shop_name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    shop_type: str | None = Field(default=None, max_length=100)
    logo_url: str | None = None
    cover_url: str | None = None


class RateableListingOut(BaseModel):
    id: uuid.UUID
    title: str


class ShopStatsOut(BaseModel):
    active_listings: int
    sold_count: int
    followers: int
    review_count: int
    average_rating: float | None
    # `is_following` is null for anonymous viewers — distinct from `false`
    # (logged in, not following), so the UI can show a login prompt instead
    # of an unfollow-looking button.
    is_following: bool | None = None
    # Null for anonymous viewers and when nothing is currently rateable.
    rateable_listing: RateableListingOut | None = None


class ShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    shop_name: str
    slug: str
    description: str | None
    shop_type: str | None
    logo_url: str | None
    cover_url: str | None
    created_at: datetime
    is_active: bool = True
    listing_count: int = 0
    follower_count: int = 0
    average_rating: float | None = None
    rating_count: int = 0


class ShopCollaboratorInviteIn(BaseModel):
    # Exact match only, deliberately -- see shop_service.invite_collaborator.
    # A fuzzy/partial search would turn this into a general user-directory
    # lookup tool, which is a real privacy leak.
    email: EmailStr


class ShopCollaboratorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    shop_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    created_at: datetime
    responded_at: datetime | None
    user_full_name: str
    user_email: str
    user_avatar_url: str | None


class ShopInviteOut(BaseModel):
    """A pending invite as seen by the invited user -- shop context, not
    the shop's full management data, since this person isn't a member yet."""

    id: uuid.UUID
    shop_id: uuid.UUID
    shop_name: str
    shop_slug: str
    shop_logo_url: str | None
    invited_by_name: str
    created_at: datetime


class ShopCollaboratorRespondIn(BaseModel):
    accept: bool
