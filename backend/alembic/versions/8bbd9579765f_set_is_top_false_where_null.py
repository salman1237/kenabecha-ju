"""set is_top false where null

Revision ID: 8bbd9579765f
Revises: 6605a57ca25d
Create Date: 2026-08-05 23:29:09.790617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8bbd9579765f'
down_revision: Union[str, None] = '6605a57ca25d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE listings SET is_top = false WHERE is_top IS NULL")


def downgrade() -> None:
    pass
