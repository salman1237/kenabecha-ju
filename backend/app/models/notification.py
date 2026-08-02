import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.listing import Listing
    from app.models.order import Order
    from app.models.shop import Shop
    from app.models.user import User


class NotificationType(str, enum.Enum):
    new_message = "new_message"
    new_rating = "new_rating"
    listing_reported = "listing_reported"
    listing_removed = "listing_removed"
    shop_reported = "shop_reported"
    shop_removed = "shop_removed"
    order_placed = "order_placed"
    order_status_changed = "order_status_changed"


class Notification(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
        Index("ix_notifications_user_id_created_at", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    link_url: Mapped[str | None] = mapped_column(Text)
    related_listing_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE")
    )
    related_shop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"))
    related_conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    related_order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE")
    )
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False)

    user: Mapped["User"] = relationship()
    related_listing: Mapped["Listing | None"] = relationship()
    related_shop: Mapped["Shop | None"] = relationship()
    related_conversation: Mapped["Conversation | None"] = relationship()
    related_order: Mapped["Order | None"] = relationship()
