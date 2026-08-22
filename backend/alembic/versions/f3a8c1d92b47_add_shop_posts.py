"""add shop posts

Adds Phase 52: a shop-authored "post" (title, sanitized rich-text
description, 0+ linked listings from the same shop, 1+ images), a
pending/published/rejected moderation queue, and the notification fan-out
to a shop's followers when a post is published.

Revision ID: f3a8c1d92b47
Revises: a1c3d7e29f4b
Create Date: 2026-08-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a8c1d92b47'
down_revision: Union[str, None] = 'a1c3d7e29f4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alembic does not diff enum values; hand-written, same as every prior
    # addition to notification_type. Safe inside the transaction on PG 12+
    # because the new label is not used by any statement in this migration.
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'shop_new_post'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'post_rejected'")

    op.create_table(
        'shop_posts',
        sa.Column('shop_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description_html', sa.Text(), nullable=False),
        sa.Column('slug', sa.String(length=220), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'published', 'rejected', name='post_status'),
            nullable=False,
        ),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_shop_posts_shop_id_shops'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_shop_posts')),
    )
    op.create_index('ix_shop_posts_shop_id', 'shop_posts', ['shop_id'], unique=False)
    op.create_index('ix_shop_posts_slug', 'shop_posts', ['slug'], unique=True)
    op.create_index('ix_shop_posts_status', 'shop_posts', ['status'], unique=False)
    op.create_index('ix_shop_posts_shop_id_created_at', 'shop_posts', ['shop_id', 'created_at'], unique=False)
    op.create_index(
        'ix_shop_posts_status_created_at', 'shop_posts', ['status', 'created_at'],
        unique=False, postgresql_where=sa.text("status = 'pending'"),
    )

    op.create_table(
        'shop_post_images',
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['shop_posts.id'], name=op.f('fk_shop_post_images_post_id_shop_posts'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_shop_post_images')),
    )
    op.create_index('ix_shop_post_images_post_id_sort_order', 'shop_post_images', ['post_id', 'sort_order'], unique=False)

    op.create_table(
        'shop_post_listings',
        sa.Column('post_id', sa.Uuid(), nullable=False),
        sa.Column('listing_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['shop_posts.id'], name=op.f('fk_shop_post_listings_post_id_shop_posts'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], name=op.f('fk_shop_post_listings_listing_id_listings'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('post_id', 'listing_id', name=op.f('pk_shop_post_listings')),
    )
    op.create_index('ix_shop_post_listings_listing_id', 'shop_post_listings', ['listing_id'], unique=False)

    op.add_column('notifications', sa.Column('related_post_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f('fk_notifications_related_post_id_shop_posts'),
        'notifications', 'shop_posts', ['related_post_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint(op.f('fk_notifications_related_post_id_shop_posts'), 'notifications', type_='foreignkey')
    op.drop_column('notifications', 'related_post_id')

    op.drop_index('ix_shop_post_listings_listing_id', table_name='shop_post_listings')
    op.drop_table('shop_post_listings')

    op.drop_index('ix_shop_post_images_post_id_sort_order', table_name='shop_post_images')
    op.drop_table('shop_post_images')

    op.drop_index('ix_shop_posts_status_created_at', table_name='shop_posts', postgresql_where=sa.text("status = 'pending'"))
    op.drop_index('ix_shop_posts_shop_id_created_at', table_name='shop_posts')
    op.drop_index('ix_shop_posts_status', table_name='shop_posts')
    op.drop_index('ix_shop_posts_slug', table_name='shop_posts')
    op.drop_index('ix_shop_posts_shop_id', table_name='shop_posts')
    op.drop_table('shop_posts')

    op.execute("DROP TYPE post_status")
    # Postgres cannot drop an enum value or un-add one. Reversing
    # `shop_new_post` means recreating notification_type and deciding what
    # happens to any row currently using it — a data question, not a schema
    # one, left to whoever needs it (same note as every prior enum addition).
