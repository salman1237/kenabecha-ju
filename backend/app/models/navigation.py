import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class NavLocation(str, enum.Enum):
    """Where a menu appears.

    The navbar is a single menu; the footer is several, one per column. Both
    are the same shape, so they share a table rather than duplicating the
    ordering, visibility and label machinery twice.
    """

    navbar = "navbar"
    footer = "footer"


class NavVisibility(str, enum.Enum):
    """Who sees a link.

    The navigation already differed by sign-in state before it was data —
    Sell, Inbox and My Shops need an account, Log in and Sign up are pointless
    once you have one. Making that a column keeps the rule with the link
    instead of scattered through JSX.
    """

    always = "always"
    signed_in = "signed_in"
    signed_out = "signed_out"


class NavMenu(UUIDPKMixin, TimestampMixin, Base):
    """The navbar, or one column of the footer."""

    __tablename__ = "nav_menus"
    __table_args__ = (Index("ix_nav_menus_location_sort", "location", "sort_order"),)

    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    location: Mapped[NavLocation] = mapped_column(
        Enum(NavLocation, name="nav_location"), nullable=False
    )

    # The bundled translation this menu's heading comes from, e.g.
    # "footer.marketplace". Resolved client-side against the shipped
    # catalogues, so the seed carries no copy and both languages stay correct
    # for anything an admin has not touched. Null for admin-created menus,
    # which must supply their own label.
    translation_key: Mapped[str | None] = mapped_column(String(64))

    # Per-locale override: {"en": "...", "bn": "..."}. Anything absent falls
    # back to `translation_key`, so editing English cannot leave Bangla stale.
    label: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    links: Mapped[list["NavLink"]] = relationship(
        back_populates="menu",
        cascade="all, delete-orphan",
        order_by="NavLink.sort_order",
        lazy="selectin",
    )


class NavLink(UUIDPKMixin, TimestampMixin, Base):
    """One destination inside a menu."""

    __tablename__ = "nav_links"
    __table_args__ = (Index("ix_nav_links_menu_sort", "menu_id", "sort_order"),)

    menu_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("nav_menus.id", ondelete="CASCADE"), nullable=False, index=True
    )

    translation_key: Mapped[str | None] = mapped_column(String(64))
    label: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    # Text, not a constrained type: internal paths and external URLs both
    # belong here, and the difference is decided at render time by whether it
    # starts with a slash.
    href: Mapped[str] = mapped_column(Text, nullable=False)

    # An optional lucide icon name, used by the mobile menu. Unknown names
    # fall back to a generic icon rather than breaking the render.
    icon: Mapped[str | None] = mapped_column(String(32))

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    visibility: Mapped[NavVisibility] = mapped_column(
        Enum(NavVisibility, name="nav_visibility"),
        nullable=False,
        default=NavVisibility.always,
        server_default="always",
    )

    menu: Mapped["NavMenu"] = relationship(back_populates="links")


class SiteSetting(UUIDPKMixin, TimestampMixin, Base):
    """A named blob of site configuration.

    Deliberately generic. The alternative — a column per switch — means a
    migration every time one is added, for values nothing in the database
    branches on. What *is* enforced is that the frontend treats a missing key
    as "use the default", so an empty table is a working site.
    """

    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")


#: The navbar controls an admin can switch off, and their defaults. Kept here
#: so the API, the seed and the admin screen agree on one list.
NAVBAR_CONTROLS: dict[str, bool] = {
    "search": True,
    "language": True,
    "theme": True,
    "notifications": True,
}

NAVBAR_CONTROLS_KEY = "navbar_controls"

#: Site-wide branding/contact info an admin can edit without a deploy —
#: logo, contact email, WhatsApp number, social links. Missing keys take
#: these defaults, same "empty row is still a working site" rule as the
#: navbar controls above.
DEFAULT_SITE_INFO: dict = {
    "logo_url": None,
    "contact_email": None,
    "whatsapp_number": None,
    "social_links": {},
}

SITE_INFO_KEY = "site_info"
