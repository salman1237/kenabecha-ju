"""add is_top to listings

Revision ID: e8b9f0a1c2d3
Revises: c3a7e4f91b2d
Create Date: 2026-08-05 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b9f0a1c2d3'
down_revision: Union[str, None] = 'c3a7e4f91b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('is_top', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('listings', 'is_top')
