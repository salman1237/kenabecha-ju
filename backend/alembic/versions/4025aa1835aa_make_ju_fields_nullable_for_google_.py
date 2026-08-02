"""make ju fields nullable for google buyers

Revision ID: 4025aa1835aa
Revises: 445c2da8c2d7
Create Date: 2026-08-02 07:27:20.912503

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4025aa1835aa'
down_revision: Union[str, None] = '445c2da8c2d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "phone", existing_type=sa.String(length=30), nullable=True)
    op.alter_column("users", "student_id", existing_type=sa.String(length=30), nullable=True)
    op.alter_column("users", "registration_no", existing_type=sa.String(length=30), nullable=True)
    op.alter_column("users", "hall_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("users", "department_id", existing_type=sa.Uuid(), nullable=True)
    op.alter_column("users", "session", existing_type=sa.String(length=7), nullable=True)
    op.alter_column("users", "batch", existing_type=sa.SmallInteger(), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "batch", existing_type=sa.SmallInteger(), nullable=False)
    op.alter_column("users", "session", existing_type=sa.String(length=7), nullable=False)
    op.alter_column("users", "department_id", existing_type=sa.Uuid(), nullable=False)
    op.alter_column("users", "hall_id", existing_type=sa.Uuid(), nullable=False)
    op.alter_column("users", "registration_no", existing_type=sa.String(length=30), nullable=False)
    op.alter_column("users", "student_id", existing_type=sa.String(length=30), nullable=False)
    op.alter_column("users", "phone", existing_type=sa.String(length=30), nullable=False)
