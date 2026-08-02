import enum
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.listing import FulfillmentType, PriceType
from app.models.mixins import CreatedAtMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.shop import Shop
    from app.models.user import User


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"


class CartItem(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("buyer_id", "listing_id", name="uq_cart_items_buyer_listing"),
        CheckConstraint("quantity >= 1", name="cart_item_quantity_positive"),
    )

    buyer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    listing: Mapped["Listing"] = relationship(lazy="selectin")


class Order(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "fulfillment_type != 'delivery' OR delivery_address IS NOT NULL",
            name="delivery_address_required_for_delivery",
        ),
        CheckConstraint("buyer_id != seller_id", name="order_buyer_seller_distinct"),
    )

    buyer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shop_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("shops.id", ondelete="SET NULL"), index=True
    )
    fulfillment_type: Mapped[FulfillmentType] = mapped_column(
        Enum(FulfillmentType, name="fulfillment_type"), nullable=False
    )
    delivery_address: Mapped[str | None] = mapped_column(Text)
    buyer_phone: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), default=OrderStatus.pending, nullable=False, index=True
    )

    buyer: Mapped["User"] = relationship(foreign_keys=[buyer_id], lazy="selectin")
    seller: Mapped["User"] = relationship(foreign_keys=[seller_id], lazy="selectin")
    shop: Mapped["Shop | None"] = relationship(lazy="selectin")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    price_type: Mapped[PriceType] = mapped_column(Enum(PriceType, name="price_type"), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    listing: Mapped["Listing"] = relationship(lazy="selectin")
