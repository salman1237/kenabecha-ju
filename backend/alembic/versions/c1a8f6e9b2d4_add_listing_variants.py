"""add listing variants

A shop listing can have priced options (size, pack quantity, edition) --
each independently priced and independently available -- instead of one
price for the whole listing. Personal listings keep today's single-price
behavior; the service layer enforces the shop-only restriction, not this
migration.

Revision ID: c1a8f6e9b2d4
Revises: b4c9d2e7a1f5
Create Date: 2026-09-27 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a8f6e9b2d4'
down_revision: Union[str, None] = 'b4c9d2e7a1f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'listing_variants',
        sa.Column('listing_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('is_available', sa.Boolean(), nullable=False),
        sa.Column('sort_order', sa.SmallInteger(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('price >= 0', name=op.f('listing_variant_price_non_negative')),
        sa.ForeignKeyConstraint(
            ['listing_id'], ['listings.id'],
            name=op.f('fk_listing_variants_listing_id_listings'), ondelete='CASCADE'
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_listing_variants')),
    )
    op.create_index(
        'ix_listing_variants_listing_id_sort_order', 'listing_variants', ['listing_id', 'sort_order']
    )


def downgrade() -> None:
    op.drop_index('ix_listing_variants_listing_id_sort_order', table_name='listing_variants')
    op.drop_table('listing_variants')
