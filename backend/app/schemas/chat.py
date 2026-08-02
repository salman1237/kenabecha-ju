import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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


class ConversationOut(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    listing_title: str
    shop: ListingShopOut | None
    counterparty: ListingSellerOut
    is_seller: bool
    last_message_preview: str | None
    last_message_at: datetime | None
    unread_count: int
    created_at: datetime
