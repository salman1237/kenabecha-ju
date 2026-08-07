import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.category import Category
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
    # Set by the expiry sweep, never by a seller. Distinct from `removed` so
    # the dashboard can offer Renew rather than treating it as taken down.
    expired = "expired"
    # Seller-initiated, reversible hide — the deactivate/reactivate toggle.
    # A real status value rather than a second boolean column so
    # browse_listings' existing `status == active` filter excludes it for
    # free, with no new WHERE clause to keep in sync everywhere status is
    # already checked (seller-reviews, related listings, the sitemap,
    # category counts).
    paused = "paused"


class FulfillmentType(str, enum.Enum):
    pickup = "pickup"
    delivery = "delivery"
    # Sellers commonly offer either, and forcing a choice pushed the second
    # option into the free-text description where nothing can filter on it.
    both = "both"


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
        Index("ix_listings_status_created_at", "status", "created_at"),
        # For a shop's own manually-ordered inventory view and storefront.
        Index("ix_listings_shop_id_sort_order", "shop_id", "sort_order"),
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
    # Nullable so the thousands of listings that predate the taxonomy stay
    # valid and browsable; new ones are required to pick one at the schema
    # layer. ondelete=SET NULL so retiring a category never deletes stock.
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
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
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus, name="listing_status"),
        default=ListingStatus.active,
        nullable=False,
        index=True,
    )
    # Manual display order, meaningful only for shop listings — a shop's own
    # storefront and inventory view default to this rather than "newest".
    # Unused (always its default) for personal listings, which have no
    # multi-item ordering to speak of.
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")
    fulfillment_type: Mapped[FulfillmentType] = mapped_column(
        Enum(FulfillmentType, name="fulfillment_type"),
        default=FulfillmentType.pickup,
        nullable=False,
    )
    pickup_address: Mapped[str | None] = mapped_column(Text)
    is_top: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, server_default="false"
    )
    # Denormalised from listing_views so browse/sort never has to aggregate.
    # listing_views stays the source of truth for de-duplication.
    view_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, server_default="0"
    )
    # Time-boxed promotion, distinct from the permanent is_top flag.
    featured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    # Nullable because listings created before expiry existed never expire;
    # the sweep and the browse filter both treat NULL as "no deadline".
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    seller: Mapped["User"] = relationship(lazy="selectin")
    shop: Mapped["Shop | None"] = relationship(lazy="selectin")
    category: Mapped["Category | None"] = relationship(lazy="selectin")
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


class ListingView(UUIDPKMixin, CreatedAtMixin, Base):
    """One row per distinct viewer per listing, per de-duplication window.

    Without this a seller's view count is just a refresh counter, which tells
    them nothing about how the listing is performing. `viewer_key` is the
    user id for signed-in viewers and a salted hash of IP + user-agent for
    anonymous ones, so the two collapse to the same column and the unique
    constraint can do the de-duplication in the database rather than in a
    read-then-write race between workers.
    """

    __tablename__ = "listing_views"
    __table_args__ = (
        UniqueConstraint("listing_id", "viewer_key", "window_start", name="uq_listing_view_window"),
        Index("ix_listing_views_listing_id_created_at", "listing_id", "created_at"),
    )

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    viewer_key: Mapped[str] = mapped_column(String(64), nullable=False)
    # Truncated to the start of the de-dup window (a UTC day). Part of the
    # unique key, so a viewer counts once per window without needing a
    # range query or a periodic cleanup job to keep the constraint useful.
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ListingRestockRequest(UUIDPKMixin, CreatedAtMixin, Base):
    """A buyer asking to be notified when an out-of-stock shop listing comes
    back.

    Uniqueness is deliberately partial, not blanket: a buyer can't queue two
    pending requests for the same listing, but *can* ask again the next time
    it runs out after being restocked once already. A flat unique constraint
    would have permanently blocked a second request forever.
    """

    __tablename__ = "listing_restock_requests"
    __table_args__ = (
        Index(
            "uq_restock_request_pending",
            "listing_id",
            "buyer_id",
            unique=True,
            postgresql_where="fulfilled_at IS NULL",
        ),
    )

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Set when the seller marks the listing available again and this
    # requester has been notified. Left in place rather than deleted, so a
    # second out-of-stock cycle on the same listing can tell a fresh request
    # apart from one already answered.
    fulfilled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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
