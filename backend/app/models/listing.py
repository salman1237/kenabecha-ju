import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.shop import Shop
    from app.models.user import User


class PriceType(str, enum.Enum):
    fixed = "fixed"
    negotiable = "negotiable"
    free = "free"


class Condition(str, enum.Enum):
    new = "new"
    used_like_new = "used_like_new"
    used_good = "used_good"
    used_fair = "used_fair"


class ListingStatus(str, enum.Enum):
    active = "active"
    sold = "sold"
    out_of_stock = "out_of_stock"
    removed = "removed"


class FulfillmentType(str, enum.Enum):
    pickup = "pickup"
    delivery = "delivery"


listing_tags = Table(
    "listing_tags",
    Base.metadata,
    Column(
        "listing_id",
        ForeignKey("listings.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_listing_tags_tag_id", "tag_id"),
)


class Listing(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint(
            "price_type != 'fixed' OR price IS NOT NULL",
            name="price_required_when_fixed",
        ),
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
        Index("ix_listings_status_created_at", "status", "created_at"),
        Index(
            "ix_listings_title_trgm",
            "title",
            postgresql_using="gin",
            postgresql_ops={"title": "gin_trgm_ops"},
        ),
        Index(
            "ix_listings_description_trgm",
            "description",
            postgresql_using="gin",
            postgresql_ops={"description": "gin_trgm_ops"},
        ),
    )

    seller_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shop_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    price_type: Mapped[PriceType] = mapped_column(
        Enum(PriceType, name="price_type"), default=PriceType.fixed, nullable=False
    )
    unit: Mapped[str | None] = mapped_column(String(20))
    condition: Mapped[Condition] = mapped_column(
        Enum(Condition, name="listing_condition"), default=Condition.new, nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus, name="listing_status"),
        default=ListingStatus.active,
        nullable=False,
        index=True,
    )
    fulfillment_type: Mapped[FulfillmentType] = mapped_column(
        Enum(FulfillmentType, name="fulfillment_type"),
        default=FulfillmentType.pickup,
        nullable=False,
    )
    pickup_address: Mapped[str | None] = mapped_column(Text)

    seller: Mapped["User"] = relationship(lazy="selectin")
    shop: Mapped["Shop | None"] = relationship(lazy="selectin")
    images: Mapped[list["ListingImage"]] = relationship(
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingImage.sort_order",
        lazy="selectin",
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary=listing_tags, back_populates="listings", lazy="selectin"
    )


class ListingImage(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "listing_images"
    __table_args__ = (Index("ix_listing_images_listing_id_sort_order", "listing_id", "sort_order"),)

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    listing: Mapped["Listing"] = relationship(back_populates="images")


class Tag(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        Index(
            "ix_tags_normalized_name_trgm",
            "normalized_name",
            postgresql_using="gin",
            postgresql_ops={"normalized_name": "gin_trgm_ops"},
        ),
    )

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, index=True)

    listings: Mapped[list["Listing"]] = relationship(secondary=listing_tags, back_populates="tags")
