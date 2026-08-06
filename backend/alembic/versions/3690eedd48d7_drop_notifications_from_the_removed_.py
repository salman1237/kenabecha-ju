"""drop notifications from the removed orders feature

Revision ID: 3690eedd48d7
Revises: 8f3b25a0c9ef
Create Date: 2026-08-06 11:04:00.971442

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3690eedd48d7'
down_revision: Union[str, None] = '8f3b25a0c9ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Notification kinds that belonged to the cart/orders feature, which was
# removed from the product. The Postgres enum still carries the labels —
# dropping a value from an enum means recreating the type — but the Python
# NotificationType no longer defines them.
OBSOLETE = ("order_placed", "order_status_changed")


def upgrade() -> None:
    """Delete notifications whose type no longer exists in the application.

    These rows made `GET /notifications` return 500 for any user who held
    one: SQLAlchemy raises `LookupError: 'order_placed' is not among the
    defined enum values` while loading the row, so a single orphan broke the
    notification bell for that account entirely.

    Deleting is right rather than remapping: they point at orders that can no
    longer be opened, so there is nothing meaningful to show the user.
    """
    op.execute(
        sa.text("DELETE FROM notifications WHERE type::text = ANY(:kinds)").bindparams(
            sa.bindparam("kinds", value=list(OBSOLETE))
        )
    )


def downgrade() -> None:
    # The rows are gone and describe a feature that no longer exists; there
    # is nothing to restore them from.
    pass
