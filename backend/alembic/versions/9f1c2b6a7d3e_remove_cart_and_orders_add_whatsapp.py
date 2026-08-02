"""remove cart and orders, add whatsapp_number

Revision ID: 9f1c2b6a7d3e
Revises: 274a093404b1
Create Date: 2026-08-02 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9f1c2b6a7d3e'
down_revision: Union[str, None] = '274a093404b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


fulfillment_type_enum = postgresql.ENUM('pickup', 'delivery', name='fulfillment_type', create_type=False)
order_status_enum = postgresql.ENUM(
    'pending', 'confirmed', 'completed', 'cancelled', name='order_status', create_type=False
)
price_type_enum = postgresql.ENUM('fixed', 'negotiable', 'free', name='price_type', create_type=False)


def upgrade() -> None:
    op.drop_constraint(
        op.f('fk_notifications_related_order_id_orders'), 'notifications', type_='foreignkey'
    )
    op.drop_column('notifications', 'related_order_id')

    op.drop_index(op.f('ix_order_items_order_id'), table_name='order_items')
    op.drop_table('order_items')
    op.drop_index(op.f('ix_cart_items_buyer_id'), table_name='cart_items')
    op.drop_table('cart_items')
    op.drop_index(op.f('ix_orders_status'), table_name='orders')
    op.drop_index(op.f('ix_orders_shop_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_seller_id'), table_name='orders')
    op.drop_index(op.f('ix_orders_buyer_id'), table_name='orders')
    op.drop_table('orders')

    bind = op.get_bind()
    order_status_enum.drop(bind, checkfirst=True)
    # fulfillment_type is kept — listings.fulfillment_type still uses it.
    # notification_type's 'order_placed'/'order_status_changed' values are left in
    # place — Postgres doesn't support dropping individual enum values, same as the
    # note in the migration that originally added them.

    op.add_column('users', sa.Column('whatsapp_number', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'whatsapp_number')

    bind = op.get_bind()
    order_status_enum.create(bind, checkfirst=True)

    op.create_table('orders',
    sa.Column('buyer_id', sa.Uuid(), nullable=False),
    sa.Column('seller_id', sa.Uuid(), nullable=False),
    sa.Column('shop_id', sa.Uuid(), nullable=True),
    sa.Column('fulfillment_type', fulfillment_type_enum, nullable=False),
    sa.Column('delivery_address', sa.Text(), nullable=True),
    sa.Column('buyer_phone', sa.Text(), nullable=False),
    sa.Column('status', order_status_enum, nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("fulfillment_type != 'delivery' OR delivery_address IS NOT NULL", name=op.f('ck_orders_delivery_address_required_for_delivery')),
    sa.CheckConstraint('buyer_id != seller_id', name=op.f('ck_orders_order_buyer_seller_distinct')),
    sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], name=op.f('fk_orders_buyer_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['seller_id'], ['users.id'], name=op.f('fk_orders_seller_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_orders_shop_id_shops'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_orders'))
    )
    op.create_index(op.f('ix_orders_buyer_id'), 'orders', ['buyer_id'], unique=False)
    op.create_index(op.f('ix_orders_seller_id'), 'orders', ['seller_id'], unique=False)
    op.create_index(op.f('ix_orders_shop_id'), 'orders', ['shop_id'], unique=False)
    op.create_index(op.f('ix_orders_status'), 'orders', ['status'], unique=False)
    op.create_table('cart_items',
    sa.Column('buyer_id', sa.Uuid(), nullable=False),
    sa.Column('listing_id', sa.Uuid(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('quantity >= 1', name=op.f('ck_cart_items_cart_item_quantity_positive')),
    sa.ForeignKeyConstraint(['buyer_id'], ['users.id'], name=op.f('fk_cart_items_buyer_id_users'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], name=op.f('fk_cart_items_listing_id_listings'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cart_items')),
    sa.UniqueConstraint('buyer_id', 'listing_id', name='uq_cart_items_buyer_listing')
    )
    op.create_index(op.f('ix_cart_items_buyer_id'), 'cart_items', ['buyer_id'], unique=False)
    op.create_table('order_items',
    sa.Column('order_id', sa.Uuid(), nullable=False),
    sa.Column('listing_id', sa.Uuid(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('price_type', price_type_enum, nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], name=op.f('fk_order_items_listing_id_listings'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name=op.f('fk_order_items_order_id_orders'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_order_items'))
    )
    op.create_index(op.f('ix_order_items_order_id'), 'order_items', ['order_id'], unique=False)

    op.add_column('notifications', sa.Column('related_order_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(op.f('fk_notifications_related_order_id_orders'), 'notifications', 'orders', ['related_order_id'], ['id'], ondelete='CASCADE')
