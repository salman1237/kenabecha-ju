import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.post import PostStatus
from app.schemas.listing import ListingOut


class PostImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_url: str
    sort_order: int


class PostShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    shop_name: str
    slug: str
    logo_url: str | None


class PostCreate(BaseModel):
    shop_id: uuid.UUID
    title: str = Field(min_length=3, max_length=200)
    description_html: str = Field(min_length=1)
    listing_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description_html: str | None = Field(default=None, min_length=1)
    listing_ids: list[uuid.UUID] | None = Field(default=None, max_length=20)


class PostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    shop: PostShopOut
    title: str
    description_html: str
    slug: str
    status: PostStatus
    rejection_reason: str | None
    images: list[PostImageOut]
    listings: list[ListingOut]
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class PostRejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)
