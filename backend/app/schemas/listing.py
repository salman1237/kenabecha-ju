import uuid
from datetime import UTC, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.listing import Condition, FulfillmentType, ListingStatus, PriceType
from app.schemas.category import CategoryRef
from app.schemas.tag import TagOut

# The fulfilment kinds that include collecting in person. `both` belongs here
# because it offers pickup as well as delivery.
OFFERS_PICKUP = {FulfillmentType.pickup, FulfillmentType.both}


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
    phone: str | None
    whatsapp_number: str | None


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
    unit: str | None = Field(default=None, max_length=20)
    condition: Condition | None = None
    shop_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list, max_length=10)
    fulfillment_type: FulfillmentType = FulfillmentType.pickup
    pickup_address: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    # Set instead of category_id when the seller's item doesn't fit any
    # category in the curated list. Mutually exclusive with category_id —
    # enforced below rather than left to whichever one the client happened
    # to send.
    custom_category: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def check_price_and_condition(self) -> "ListingCreate":
        if self.price_type == PriceType.fixed and self.price is None:
            raise ValueError("Price is required for fixed-price listings")
        if self.shop_id is None and self.condition is None:
            raise ValueError("Condition is required for personal listings")
        # `both` includes pickup, so it needs an address just as much as
        # `pickup` does — the buyer still has to know where to collect from.
        if self.fulfillment_type in OFFERS_PICKUP and not self.pickup_address:
            raise ValueError("Pickup address is required when pickup is offered")
        if self.fulfillment_type == FulfillmentType.delivery:
            self.pickup_address = None
        if self.custom_category is not None:
            self.category_id = None
        return self


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    price: Decimal | None = Field(default=None, ge=0)
    price_type: PriceType | None = None
    unit: str | None = Field(default=None, max_length=20)
    condition: Condition | None = None
    tags: list[str] | None = Field(default=None, max_length=10)
    fulfillment_type: FulfillmentType | None = None
    pickup_address: str | None = Field(default=None, max_length=500)
    category_id: uuid.UUID | None = None
    custom_category: str | None = Field(default=None, max_length=100)
    is_top: bool | None = None
    # Note: pickup/delivery consistency for updates is validated in listing_service.update_listing
    # against the merged final state, not here — a partial update might change only one of the two
    # fields while the other keeps its existing value on the model.

    @model_validator(mode="after")
    def clear_category_when_custom(self) -> "ListingUpdate":
        # Mirrors ListingCreate: a custom category name always wins over a
        # stale category_id from the same submit, rather than leaving both
        # set and having the model's actual category depend on dict order.
        if "custom_category" in self.model_fields_set and self.custom_category is not None:
            self.category_id = None
        return self


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    price: Decimal | None
    price_type: PriceType
    unit: str | None
    condition: Condition
    status: ListingStatus
    sort_order: int = 0
    fulfillment_type: FulfillmentType
    pickup_address: str | None
    is_top: bool
    view_count: int = 0
    featured_until: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime
    seller: ListingSellerOut
    shop: ListingShopOut | None
    category: CategoryRef | None = None
    custom_category: str | None = None
    images: list[ListingImageOut]
    tags: list[TagOut]
    # Both default to their "not applicable" value and are only ever
    # actually populated by the router handlers that can afford the extra
    # targeted query — get_listing (one detail page) sets the former,
    # list_my_listings (one seller's own inventory) sets the latter. Left
    # unset everywhere else (bulk browse) rather than computed per row,
    # which would be an N+1 on every listing in a results page.
    has_pending_restock_request: bool | None = None
    restock_request_count: int = 0

    @computed_field
    @property
    def is_featured(self) -> bool:
        """Whether the promotion is live right now. Computed here rather than
        left to the client, so every surface agrees on the cutoff instead of
        each one re-implementing the comparison against its own clock."""
        return self.featured_until is not None and self.featured_until > datetime.now(UTC)


class ListingImageOrderIn(BaseModel):
    """Every image id on the listing, in the order they should appear."""

    image_ids: list[uuid.UUID] = Field(min_length=1)


class ListingOrderIn(BaseModel):
    """Every listing id in one shop's inventory, in the order they should
    appear. Shop-scoped rather than global — personal listings have no
    manual order to speak of."""

    shop_id: uuid.UUID
    listing_ids: list[uuid.UUID] = Field(min_length=1)


class ListingFeatureIn(BaseModel):
    # None clears the promotion. Bounded so a stray value can't pin a listing
    # to the top of browse indefinitely.
    days: int | None = Field(default=None, ge=1, le=90)
