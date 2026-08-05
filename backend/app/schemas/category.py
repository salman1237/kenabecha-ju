import uuid

from pydantic import BaseModel, ConfigDict


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


class CategoryOut(CategoryChildOut):
    """Top-level category. `listing_count` is inclusive of children."""

    children: list[CategoryChildOut] = []
