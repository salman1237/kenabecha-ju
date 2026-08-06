"""audit log uses clock_timestamp

Revision ID: 46c7b654c1b7
Revises: bc8039bd9e11
Create Date: 2026-08-06 16:35:03.011550

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '46c7b654c1b7'
down_revision: Union[str, None] = 'bc8039bd9e11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hand-written: autogenerate produced an empty migration because Alembic
    # does not compare server defaults unless compare_server_default is on —
    # which it now is (see alembic/env.py), so this class of drift is caught
    # from here on.
    #
    # now() is the transaction start time, so two entries written in one
    # transaction shared a timestamp and their order was undefined.
    op.execute("ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT clock_timestamp()")


def downgrade() -> None:
    op.execute("ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT now()")
