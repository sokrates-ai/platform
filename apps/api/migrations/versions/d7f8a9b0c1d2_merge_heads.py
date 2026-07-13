"""Merge divergent migration heads

Brings the three open lineages (selected-tab-for-tutor-room-selection,
rename-user-role-to-student and trailstep-completed-verified-dates) back
into a single head so `alembic upgrade` works again.

Revision ID: d7f8a9b0c1d2
Revises: a1b2c3d4e5f6, 9f4b1a2c3d5e, c9a1b2d3e4f5
Create Date: 2026-07-13 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "d7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = (
    "a1b2c3d4e5f6",
    "9f4b1a2c3d5e",
    "c9a1b2d3e4f5",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
