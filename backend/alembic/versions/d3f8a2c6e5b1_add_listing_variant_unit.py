"""add listing variant unit

Each option can be sold per unit (e.g. "kg") independently of any other
option on the same listing -- a fish seller's 800g-900g option and its
1kg-1.2kg option are both priced per kg, but a shop selling both loose
pieces and boxed packs might price one per piece and the other per box.

Revision ID: d3f8a2c6e5b1
Revises: c1a8f6e9b2d4
Create Date: 2026-09-28 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f8a2c6e5b1'
down_revision: Union[str, None] = 'c1a8f6e9b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listing_variants', sa.Column('unit', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('listing_variants', 'unit')
