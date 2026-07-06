"""Add completed_date and verified_date to trailstep

Also merges the two open migration heads (allow-null-predecessor and
instance-feature-flags) into a single lineage.

Revision ID: c9a1b2d3e4f5
Revises: 1d9f3c4b2a10, e35a7c2d9f10
Create Date: 2026-07-06 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9a1b2d3e4f5'
down_revision: Union[str, Sequence[str], None] = ('1d9f3c4b2a10', 'e35a7c2d9f10')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'trailstep',
        sa.Column('completed_date', sa.String(), nullable=True),
    )
    op.add_column(
        'trailstep',
        sa.Column('verified_date', sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('trailstep', 'verified_date')
    op.drop_column('trailstep', 'completed_date')
