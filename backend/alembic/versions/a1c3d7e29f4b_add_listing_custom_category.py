"""add listing custom_category

Free-text fallback for a listing whose real category isn't in the curated
list — set instead of category_id, never alongside a real one.

Revision ID: a1c3d7e29f4b
Revises: f70ce888ab57
Create Date: 2026-08-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3d7e29f4b'
down_revision: Union[str, None] = '6905f440f5d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('custom_category', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'custom_category')
