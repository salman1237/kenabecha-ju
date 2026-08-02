import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.listing import FulfillmentType, ListingStatus, PriceType
from app.models.order import OrderStatus
from app.schemas.listing import ListingImageOut, ListingSellerOut, ListingShopOut


class CartItemCreate(BaseModel):
    listing_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)


class CartListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    price: Decimal | None
    price_type: PriceType
    quantity: int
    status: ListingStatus
    fulfillment_type: FulfillmentType
    pickup_address: str | None
    images: list[ListingImageOut]
    seller: ListingSellerOut
    shop: ListingShopOut | None


class CartItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quantity: int
    listing: CartListingOut
    created_at: datetime


class CheckoutRequest(BaseModel):
    buyer_phone: str = Field(min_length=1, max_length=30)
    delivery_address: str | None = Field(default=None, max_length=500)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quantity: int
    unit_price: Decimal | None
    price_type: PriceType
    listing: CartListingOut


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    buyer: ListingSellerOut
    seller: ListingSellerOut
    shop: ListingShopOut | None
    fulfillment_type: FulfillmentType
    delivery_address: str | None
    buyer_phone: str
    status: OrderStatus
    items: list[OrderItemOut]
    created_at: datetime


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
