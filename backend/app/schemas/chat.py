import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.listing import ListingStatus, PriceType
from app.schemas.listing import ListingSellerOut, ListingShopOut


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    content: str
    created_at: datetime
    read_at: datetime | None


class ConversationListingOut(BaseModel):
    """Compact listing preview shown as a product card at the top of a chat
    thread, so both sides immediately see which listing the conversation is
    about — not a real chat message, just context rendered client-side."""

    id: uuid.UUID
    title: str
    price: Decimal | None
    price_type: PriceType
    status: ListingStatus
    image_url: str | None


class ConversationOut(BaseModel):
    id: uuid.UUID
    listing: ConversationListingOut
    shop: ListingShopOut | None
    counterparty: ListingSellerOut
    is_seller: bool
    last_message_preview: str | None
    last_message_at: datetime | None
    unread_count: int
    created_at: datetime
