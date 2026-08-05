import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class ShopFollow(UUIDPKMixin, CreatedAtMixin, Base):
    """A user following a shop. One-directional and public — following is a
    discovery signal ("show me their new listings"), not a relationship
    needing the shop owner's approval."""

    __tablename__ = "shop_follows"
    __table_args__ = (UniqueConstraint("user_id", "shop_id", name="uq_shop_follows_user_shop"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True
    )
