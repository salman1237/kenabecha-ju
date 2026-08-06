import uuid

from pydantic import BaseModel, ConfigDict, Field


class CategoryRef(BaseModel):
    """Minimal shape embedded on a listing."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    icon: str | None


class CategoryChildOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    icon: str | None
    listing_count: int
    is_active: bool = True


class CategoryOut(CategoryChildOut):
    """Top-level category. `listing_count` is inclusive of children."""

    children: list[CategoryChildOut] = []


# --- admin -------------------------------------------------------------------


class AdminCategoryOut(BaseModel):
    """The flat shape the admin screen manages.

    Flat rather than nested because the screen edits one row at a time and
    needs `parent_id` addressable; the tree is rebuilt client-side. It also
    carries `listing_count` over *all* listings, not just active ones, since
    that is the number that decides whether a delete is safe.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    icon: str | None
    parent_id: uuid.UUID | None
    sort_order: int
    is_active: bool
    listing_count: int = 0


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    icon: str | None = Field(default=None, max_length=16)
    parent_id: uuid.UUID | None = None


class CategoryUpdate(BaseModel):
    """Every field optional; only what is sent is changed.

    `icon` and `parent_id` are nullable *and* optional, which JSON cannot
    tell apart on its own — the service is handed explicit `*_set` flags
    derived from `model_fields_set` so that clearing an icon and leaving it
    alone stay distinguishable.
    """

    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    icon: str | None = Field(default=None, max_length=16)
    parent_id: uuid.UUID | None = None
    is_active: bool | None = None


class CategoryOrderIn(BaseModel):
    """One level's order. `parent_id` is null for the top level."""

    parent_id: uuid.UUID | None = None
    category_ids: list[uuid.UUID]
