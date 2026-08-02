import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    listing_count: int = 0
    average_rating: float | None = None
    rating_count: int = 0
