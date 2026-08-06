"""add moderator role

Revision ID: ac73d6d3bc52
Revises: 3690eedd48d7
Create Date: 2026-08-06 16:08:16.362308

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac73d6d3bc52'
down_revision: Union[str, None] = '3690eedd48d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alembic does not diff enum values; hand-written, as for `expired` and
    # `both` before it. Safe inside the transaction on PG 12+ because the new
    # label is not used by any statement in this migration.
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator'")


def downgrade() -> None:
    # Postgres cannot drop an enum value. Reversing means recreating the type
    # and deciding what happens to anyone currently holding the role — a data
    # question, not a schema one, so it is left to whoever needs it.
    raise NotImplementedError(
        "Removing an enum value requires recreating user_role and reassigning "
        "any users currently set to 'moderator'."
    )
