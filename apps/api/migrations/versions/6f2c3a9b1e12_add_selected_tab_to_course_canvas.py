"""Add selected tab to course canvas

Revision ID: 6f2c3a9b1e12
Revises: b6c2c2f3a6d4
Create Date: 2026-03-06 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f2c3a9b1e12'
down_revision: Union[str, None] = 'b6c2c2f3a6d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'coursecanvas',
        sa.Column('selected_tab_id', sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('coursecanvas', 'selected_tab_id')
