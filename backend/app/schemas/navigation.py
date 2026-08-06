import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.navigation import NavLocation, NavVisibility


class NavLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    #: The bundled translation to fall back to. Null for admin-created links,
    #: which carry their own text in `label`.
    translation_key: str | None
    #: Per-locale override, e.g. {"en": "...", "bn": "..."}.
    label: dict
    href: str
    icon: str | None
    sort_order: int
    is_active: bool
    visibility: NavVisibility


class NavMenuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    location: NavLocation
    translation_key: str | None
    label: dict
    sort_order: int
    is_active: bool
    links: list[NavLinkOut] = []


class NavigationOut(BaseModel):
    """Everything the navbar and footer need, in one request.

    One payload rather than two endpoints because both render on every page;
    splitting them would double the round trips for no benefit.
    """

    menus: list[NavMenuOut]
    navbar_controls: dict[str, bool]
    #: The site-wide banner, when one is live. Carried here rather than on its
    #: own endpoint because both are site chrome fetched once in the root
    #: layout, and a second round trip per page for an optional banner is not
    #: worth it. Null is the normal case.
    announcement: dict | None = None


# --- admin input -------------------------------------------------------------


class NavMenuCreate(BaseModel):
    location: NavLocation
    label: dict = Field(default_factory=dict)


class NavMenuUpdate(BaseModel):
    label: dict | None = None
    is_active: bool | None = None


class NavLinkCreate(BaseModel):
    label: dict = Field(default_factory=dict)
    href: str = Field(min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=32)
    visibility: NavVisibility = NavVisibility.always


class NavLinkUpdate(BaseModel):
    label: dict | None = None
    href: str | None = Field(default=None, min_length=1, max_length=500)
    icon: str | None = Field(default=None, max_length=32)
    visibility: NavVisibility | None = None
    is_active: bool | None = None


class NavMenuOrderIn(BaseModel):
    location: NavLocation
    menu_ids: list[uuid.UUID]


class NavLinkOrderIn(BaseModel):
    link_ids: list[uuid.UUID]


class NavbarControlsIn(BaseModel):
    """Only the named controls change; anything omitted keeps its value."""

    controls: dict[str, bool]
