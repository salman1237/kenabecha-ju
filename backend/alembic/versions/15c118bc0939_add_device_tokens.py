"""add device tokens

Adds Phase 5c push notifications: `device_tokens` stores each device's FCM
registration token so `notification_service.notify()` can fan a push out
alongside its existing in-app-WS and email delivery paths.

Revision ID: 15c118bc0939
Revises: 443f1e914269
Create Date: 2026-09-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15c118bc0939'
down_revision: Union[str, None] = '443f1e914269'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('device_tokens',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('fcm_token', sa.String(length=300), nullable=False),
    sa.Column('platform', sa.String(length=20), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_device_tokens_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_device_tokens')),
    sa.UniqueConstraint('fcm_token', name=op.f('uq_device_tokens_fcm_token'))
    )
    op.create_index(op.f('ix_device_tokens_user_id'), 'device_tokens', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_device_tokens_user_id'), table_name='device_tokens')
    op.drop_table('device_tokens')
