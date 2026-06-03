"""Add instance feature flags

Revision ID: e35a7c2d9f10
Revises: c3f4e5a6b7c8
Create Date: 2026-06-03 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e35a7c2d9f10"
down_revision: Union[str, None] = "c3f4e5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instance_feature_flag",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("audience", sa.JSON(), nullable=True),
        sa.Column("creation_date", sa.String(), nullable=True),
        sa.Column("update_date", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index(
        "ix_instance_feature_flag_key",
        "instance_feature_flag",
        ["key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_instance_feature_flag_key", table_name="instance_feature_flag")
    op.drop_table("instance_feature_flag")
