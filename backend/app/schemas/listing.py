import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.listing import Condition, ListingStatus, PriceType
from app.schemas.tag import TagOut


class ListingImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    image_url: str
    sort_order: int


class ListingSellerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    avatar_url: str | None


class ListingShopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    shop_name: str
    slug: str
    logo_url: str | None


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1)
    price: Decimal | None = Field(default=None, ge=0)
    price_type: PriceType = PriceType.fixed
    condition: Condition | None = None
    quantity: int | None = Field(default=None, ge=0)
    shop_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def check_price_and_condition(self) -> "ListingCreate":
        if self.price_type == PriceType.fixed and self.price is None:
            raise ValueError("Price is required for fixed-price listings")
        if self.shop_id is None and self.condition is None:
            raise ValueError("Condition is required for personal listings")
        return self


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    price: Decimal | None = Field(default=None, ge=0)
    price_type: PriceType | None = None
    condition: Condition | None = None
    quantity: int | None = Field(default=None, ge=0)
    tags: list[str] | None = Field(default=None, max_length=10)


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    price: Decimal | None
    price_type: PriceType
    condition: Condition
    quantity: int
    status: ListingStatus
    created_at: datetime
    seller: ListingSellerOut
    shop: ListingShopOut | None
    images: list[ListingImageOut]
    tags: list[TagOut]
