import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, SmallInteger, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.listing import Listing
    from app.models.shop import Shop
    from app.models.user import User


class RatingTargetType(str, enum.Enum):
    shop = "shop"
    user = "user"


class Rating(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("listing_id", "rater_id", name="uq_ratings_listing_rater"),
        CheckConstraint(
            "(target_type = 'shop' AND target_shop_id IS NOT NULL AND target_user_id IS NULL) OR "
            "(target_type = 'user' AND target_user_id IS NOT NULL AND target_shop_id IS NULL)",
            name="rating_target_matches_type",
        ),
        CheckConstraint("stars BETWEEN 1 AND 5", name="stars_range"),
    )

    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False
    )
    rater_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_type: Mapped[RatingTargetType] = mapped_column(
        Enum(RatingTargetType, name="rating_target_type"), nullable=False
    )
    target_shop_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), index=True
    )
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    stars: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    review_text: Mapped[str | None] = mapped_column(Text)

    listing: Mapped["Listing"] = relationship()
    rater: Mapped["User"] = relationship(foreign_keys=[rater_id], lazy="selectin")
    target_shop: Mapped["Shop | None"] = relationship()
    target_user: Mapped["User | None"] = relationship(foreign_keys=[target_user_id])
