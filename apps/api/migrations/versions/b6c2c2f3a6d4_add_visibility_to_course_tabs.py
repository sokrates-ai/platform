"""Add visibility controls to course tabs

Revision ID: b6c2c2f3a6d4
Revises: 8c5b1b4236a0
Create Date: 2026-02-17 10:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6c2c2f3a6d4'
down_revision: Union[str, None] = '8c5b1b4236a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'course_tab',
        sa.Column('visible', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'course_tab',
        sa.Column('visible_after', sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('course_tab', 'visible_after')
    op.drop_column('course_tab', 'visible')
