"""add both to fulfillment_type

Revision ID: 8f3b25a0c9ef
Revises: 87818c74aa4c
Create Date: 2026-08-06 08:49:39.449703

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f3b25a0c9ef'
down_revision: Union[str, None] = '87818c74aa4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alembic does not diff enum values, so this is hand-written. Safe inside
    # the migration's transaction on PG 12+ provided the new label isn't used
    # in the same transaction — nothing below writes it.
    op.execute("ALTER TYPE fulfillment_type ADD VALUE IF NOT EXISTS 'both'")


def downgrade() -> None:
    # Postgres cannot drop a value from an enum. Reversing this means
    # rebuilding the type, which requires first deciding what to do with rows
    # already set to 'both' — a data question, not a schema one, so it is
    # left to whoever needs the downgrade rather than guessed at here.
    raise NotImplementedError(
        "Removing an enum value requires recreating fulfillment_type and "
        "remapping any listings currently set to 'both'."
    )
