import enum

from sqlalchemy import Boolean, Enum, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class SectionType(str, enum.Enum):
    """The kinds of section that can appear on the landing page.

    These are *code*, not data: each one has a React component that knows how
    to fetch and render its own content. An admin can add, remove, reorder,
    hide and retitle instances of these types, but cannot invent a new type
    without a component to render it.

    The alternative — free-form blocks with a rich-text editor — is a page
    builder, and a much larger product. This keeps every section's data
    correct and typed while still letting the page be rearranged.
    """

    hero = "hero"
    stats = "stats"
    top_products = "top_products"
    latest_listings = "latest_listings"
    featured_shops = "featured_shops"
    categories = "categories"
    how_it_works = "how_it_works"
    reviews = "reviews"
    cta = "cta"
    newsletter = "newsletter"


class PageSection(UUIDPKMixin, TimestampMixin, Base):
    """One section on the landing page.

    Ordering, visibility and copy live here rather than in JSX, so the page
    can be rearranged without a deploy.
    """

    __tablename__ = "page_sections"
    __table_args__ = (Index("ix_page_sections_sort_order", "sort_order"),)

    # Stable identifier, unique per section instance. Used by the frontend as
    # a React key and by the admin UI to address a row. Distinct from `type`
    # because the same type may legitimately appear twice — two listing rails
    # with different titles, say.
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    section_type: Mapped[SectionType] = mapped_column(
        Enum(SectionType, name="section_type"), nullable=False
    )

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Hidden rather than removed. Deleting is also possible, but hiding is the
    # reversible option and is what an admin usually wants when trying
    # something out.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Per-section options. Copy overrides are stored per locale — for example
    # {"title": {"en": "...", "bn": "..."}} — so a change to one language does
    # not silently leave the other stale. Anything absent falls back to the
    # bundled translations, which means an empty settings object renders
    # exactly what the site shipped with.
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
