import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Index, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, SoftDeleteMixin, TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.shop import Shop


class PostStatus(str, enum.Enum):
    pending = "pending"
    published = "published"
    rejected = "rejected"


post_listings = Table(
    "shop_post_listings",
    Base.metadata,
    Column("post_id", ForeignKey("shop_posts.id", ondelete="CASCADE"), primary_key=True),
    Column("listing_id", ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_shop_post_listings_listing_id", "listing_id"),
)


class ShopPost(UUIDPKMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "shop_posts"
    __table_args__ = (
        Index("ix_shop_posts_shop_id_created_at", "shop_id", "created_at"),
        Index(
            "ix_shop_posts_status_created_at",
            "status",
            "created_at",
            postgresql_where="status = 'pending'",
        ),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Sanitized HTML — see app/services/sanitize.py. Never written from a
    # router directly; always passed through sanitize_post_html() first.
    description_html: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, nullable=False, index=True)
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus, name="post_status"), default=PostStatus.pending, nullable=False, index=True
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    # Set once, on first publish — not reset on a later resubmit-to-pending
    # cycle, so "when did this first go live" stays answerable.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    shop: Mapped["Shop"] = relationship(lazy="selectin")
    images: Mapped[list["ShopPostImage"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", order_by="ShopPostImage.sort_order", lazy="selectin"
    )
    listings: Mapped[list["Listing"]] = relationship(secondary=post_listings, lazy="selectin")


class ShopPostImage(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "shop_post_images"
    __table_args__ = (Index("ix_shop_post_images_post_id_sort_order", "post_id", "sort_order"),)

    post_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shop_posts.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False, server_default="0")

    post: Mapped["ShopPost"] = relationship(back_populates="images")
