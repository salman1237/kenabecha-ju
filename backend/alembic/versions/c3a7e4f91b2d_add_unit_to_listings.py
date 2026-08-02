"""add unit to listings

Revision ID: c3a7e4f91b2d
Revises: 9f1c2b6a7d3e
Create Date: 2026-08-02 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3a7e4f91b2d'
down_revision: Union[str, None] = '9f1c2b6a7d3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('unit', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('listings', 'unit')
