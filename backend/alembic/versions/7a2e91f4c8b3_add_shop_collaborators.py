"""add shop collaborators

Adds shop_collaborators: one shop owner can invite another registered user
(by exact email) to co-manage a shop -- edit it, its listings, its posts --
without becoming a second owner. A pending invite becomes accepted or
declined; re-inviting after a decline resets the same row rather than
creating a second one, since (shop_id, user_id) is unique.

Revision ID: 7a2e91f4c8b3
Revises: 15c118bc0939
Create Date: 2026-09-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a2e91f4c8b3'
down_revision: Union[str, None] = '15c118bc0939'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alembic does not diff enum values; hand-written, same as every prior
    # addition to notification_type (safe inside the transaction on PG 12+
    # because the new label is not used by any statement in this migration).
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'shop_collaborator_invite'")
    op.execute("ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'shop_collaborator_responded'")

    op.create_table(
        'shop_collaborators',
        sa.Column('shop_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('invited_by', sa.Uuid(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'accepted', 'declined', name='shop_collaborator_status'),
            nullable=False,
        ),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.id'], name=op.f('fk_shop_collaborators_shop_id_shops'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_shop_collaborators_user_id_users'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], name=op.f('fk_shop_collaborators_invited_by_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_shop_collaborators')),
        sa.UniqueConstraint('shop_id', 'user_id', name=op.f('uq_shop_collaborators_shop_id_user_id')),
    )
    op.create_index('ix_shop_collaborators_shop_id', 'shop_collaborators', ['shop_id'], unique=False)
    op.create_index('ix_shop_collaborators_user_id', 'shop_collaborators', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_shop_collaborators_user_id', table_name='shop_collaborators')
    op.drop_index('ix_shop_collaborators_shop_id', table_name='shop_collaborators')
    op.drop_table('shop_collaborators')

    op.execute("DROP TYPE shop_collaborator_status")
    # Postgres cannot drop an enum value or un-add one. Reversing the two
    # notification_type additions means recreating that enum and deciding
    # what happens to any row already using them -- a data question, not a
    # schema one, left to whoever needs it (same note as every prior enum
    # addition in this project).
