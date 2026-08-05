import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.listing import Listing


class SavedListing(UUIDPKMixin, CreatedAtMixin, Base):
    """A user's bookmarked listing. Same shape the old cart_items had
    (user + listing, no quantity) but with none of the ordering semantics —
    saving is a private bookmark, it doesn't signal intent to the seller."""

    __tablename__ = "saved_listings"
    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_saved_listings_user_listing"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )

    listing: Mapped["Listing"] = relationship(lazy="selectin")
