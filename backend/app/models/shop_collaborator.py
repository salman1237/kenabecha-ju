import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.shop import Shop
    from app.models.user import User


class ShopCollaboratorStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class ShopCollaborator(UUIDPKMixin, TimestampMixin, Base):
    """An invited co-manager of a shop, invited by exact email address.

    One row per (shop, user) pair -- re-inviting after a decline updates
    the same row back to pending rather than accumulating history, since
    nothing here needs an audit trail beyond "what's the current state".
    """

    __tablename__ = "shop_collaborators"
    __table_args__ = (
        UniqueConstraint("shop_id", "user_id", name="uq_shop_collaborators_shop_id_user_id"),
        Index("ix_shop_collaborators_user_id", "user_id"),
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ShopCollaboratorStatus] = mapped_column(
        Enum(ShopCollaboratorStatus, name="shop_collaborator_status"),
        default=ShopCollaboratorStatus.pending,
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    shop: Mapped["Shop"] = relationship(lazy="selectin")
    user: Mapped["User"] = relationship(foreign_keys=[user_id], lazy="selectin")
