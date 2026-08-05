import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, UUIDPKMixin

if TYPE_CHECKING:
    pass


class Category(UUIDPKMixin, CreatedAtMixin, Base):
    """A listing category, optionally nested one level under a parent.

    Deliberately a fixed two-level taxonomy (top-level → subcategory)
    rather than arbitrary depth: it's what a campus marketplace actually
    needs, it keeps "listings in this category" a single-level descendant
    lookup instead of a recursive CTE, and it makes the sidebar trivially
    renderable. Tags stay as the freeform layer on top.
    """

    __tablename__ = "categories"
    __table_args__ = (Index("ix_categories_parent_sort", "parent_id", "sort_order"),)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    #: Emoji shown in the sidebar/cards. Emoji avoids shipping an icon set
    #: and renders identically in both languages.
    icon: Mapped[str | None] = mapped_column(String(16))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    children: Mapped[list["Category"]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="Category.sort_order",
        lazy="selectin",
    )
    parent: Mapped["Category | None"] = relationship(
        back_populates="children", remote_side="Category.id"
    )
