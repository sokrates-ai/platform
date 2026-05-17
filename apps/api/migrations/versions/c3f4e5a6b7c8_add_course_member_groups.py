"""Add course member groups and pending completion sync

Revision ID: c3f4e5a6b7c8
Revises: 9f4b1a2c3d5e, a1b2c3d4e5f6
Create Date: 2026-05-17 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3f4e5a6b7c8"
down_revision: Union[str, tuple[str, str], None] = (
    "9f4b1a2c3d5e",
    "a1b2c3d4e5f6",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_member_group",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
    )

    op.create_table(
        "course_member_group_member",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("course_member_group.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
        sa.UniqueConstraint("group_id", "user_id", name="uq_course_member_group_member"),
        sa.UniqueConstraint(
            "course_id",
            "user_id",
            name="uq_course_member_group_member_per_course",
        ),
    )

    op.create_table(
        "course_member_group_invite",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("course_member_group.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
    )

    op.create_table(
        "course_member_group_pending_completion",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("course_member_group.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("course.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_user_id",
            sa.Integer(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("activity_uuid", sa.String(), nullable=False),
        sa.Column("creation_date", sa.String(), nullable=False),
        sa.Column("update_date", sa.String(), nullable=False),
        sa.UniqueConstraint(
            "course_id",
            "user_id",
            "activity_uuid",
            name="uq_course_member_group_pending_completion",
        ),
    )


def downgrade() -> None:
    op.drop_table("course_member_group_pending_completion")
    op.drop_table("course_member_group_invite")
    op.drop_table("course_member_group_member")
    op.drop_table("course_member_group")
