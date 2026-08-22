"""seed posts navbar link

The Posts feed (Phase 52) shipped with no entry in the navbar's own seeded
data, so it was reachable only by a direct URL — real gap flagged by the
user after the feature went live. Inserts it into the existing seeded
`navbar` menu, positioned right after "Browse Shops" and before the
signed-in-only actions, matching FALLBACK_NAVIGATION's own reordering.

Revision ID: 443f1e914269
Revises: f3a8c1d92b47
Create Date: 2026-08-22 17:10:00.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '443f1e914269'
down_revision: Union[str, None] = 'f3a8c1d92b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    navbar_id = conn.execute(
        sa.text("SELECT id FROM nav_menus WHERE key = 'navbar'")
    ).scalar_one_or_none()
    if navbar_id is None:
        # A fresh install that hasn't run the navigation-seeding migration's
        # data (only plausible if that migration was ever skipped/reverted
        # by hand) — nothing to attach to, and nothing this migration should
        # invent a menu for.
        return

    # Make room at sort_order 2: the three originally-seeded links after
    # "Browse Shops" shift down by one so Posts lands right behind it.
    # Targeted by translation_key rather than "sort_order >= 2" so this
    # doesn't reshuffle anything an admin has since added or reordered by
    # hand through the navigation editor.
    conn.execute(
        sa.text(
            "UPDATE nav_links SET sort_order = sort_order + 1 "
            "WHERE menu_id = :menu_id "
            "AND translation_key IN ('nav.sell', 'nav.inbox', 'nav.myShops')"
        ),
        {"menu_id": navbar_id},
    )

    links = sa.table(
        "nav_links",
        sa.column("id", sa.Uuid),
        sa.column("menu_id", sa.Uuid),
        sa.column("translation_key", sa.String),
        sa.column("label", postgresql.JSONB),
        sa.column("href", sa.Text),
        sa.column("icon", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("visibility", postgresql.ENUM(name="nav_visibility", create_type=False)),
    )
    op.bulk_insert(
        links,
        [
            {
                "id": uuid.uuid4(),
                "menu_id": navbar_id,
                "translation_key": "nav.posts",
                "label": {},
                "href": "/posts",
                "icon": "Megaphone",
                "sort_order": 2,
                "is_active": True,
                "visibility": "always",
            }
        ],
    )


def downgrade() -> None:
    conn = op.get_bind()
    navbar_id = conn.execute(
        sa.text("SELECT id FROM nav_menus WHERE key = 'navbar'")
    ).scalar_one_or_none()
    if navbar_id is None:
        return

    conn.execute(
        sa.text(
            "DELETE FROM nav_links WHERE menu_id = :menu_id AND translation_key = 'nav.posts'"
        ),
        {"menu_id": navbar_id},
    )
    conn.execute(
        sa.text(
            "UPDATE nav_links SET sort_order = sort_order - 1 "
            "WHERE menu_id = :menu_id "
            "AND translation_key IN ('nav.sell', 'nav.inbox', 'nav.myShops')"
        ),
        {"menu_id": navbar_id},
    )
