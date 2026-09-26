"""add jewellery category

A new top-level category (with subcategories) so jewellery sellers have
somewhere to list that isn't "Watches & Accessories". Slotted in just before
"Other", which is pushed down one place so the catch-all stays last.

Idempotent by slug: a category an admin already created by hand with the same
slug is left untouched instead of colliding on the unique index.

Revision ID: b4c9d2e7a1f5
Revises: 7a2e91f4c8b3
Create Date: 2026-09-26 10:00:00.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c9d2e7a1f5'
down_revision: Union[str, None] = '7a2e91f4c8b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PARENT = ("Jewellery", "jewellery", "💍")
CHILDREN = [
    ("Rings", "rings"),
    ("Necklaces & Pendants", "necklaces-pendants"),
    ("Earrings", "earrings"),
    ("Bangles & Bracelets", "bangles-bracelets"),
    ("Other Jewellery", "other-jewellery"),
]


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(sa.text("SELECT 1 FROM categories WHERE slug = :s"), {"s": PARENT[1]}).first()
    if exists:
        return

    # Keep the catch-all last: move "Other" down one before taking its slot.
    conn.execute(sa.text("UPDATE categories SET sort_order = sort_order + 1 WHERE slug = 'other'"))
    other_order = conn.execute(sa.text("SELECT sort_order FROM categories WHERE slug = 'other'")).scalar()
    parent_order = (other_order - 1) if other_order is not None else 7

    categories = sa.table(
        "categories",
        sa.column("id", sa.Uuid),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("icon", sa.String),
        sa.column("parent_id", sa.Uuid),
        sa.column("sort_order", sa.Integer),
    )
    parent_id = uuid.uuid4()
    rows = [{"id": parent_id, "name": PARENT[0], "slug": PARENT[1], "icon": PARENT[2],
             "parent_id": None, "sort_order": parent_order}]
    for order, (name, slug) in enumerate(CHILDREN):
        rows.append({"id": uuid.uuid4(), "name": name, "slug": slug, "icon": None,
                     "parent_id": parent_id, "sort_order": order})
    op.bulk_insert(categories, rows)


def downgrade() -> None:
    conn = op.get_bind()
    # Listings' category FK is ON DELETE SET NULL, so this uncategorises any
    # jewellery listings rather than failing.
    conn.execute(sa.text("DELETE FROM categories WHERE slug = 'jewellery'"))
    conn.execute(sa.text("UPDATE categories SET sort_order = sort_order - 1 WHERE slug = 'other'"))
