"""Merge heads

Revision ID: 6f2d2d92e8e1
Revises: b6c2c2f3a6d4, 1d9f3c4b2a10
Create Date: 2026-03-03 00:00:00.000000
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "6f2d2d92e8e1"
down_revision: Union[str, tuple[str, str], None] = ("b6c2c2f3a6d4", "1d9f3c4b2a10")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
