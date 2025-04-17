"""add_tasks_tags_course

Revision ID: ec6b2b783199
Revises: 76d8ec2b5b9b
Create Date: 2025-04-14 10:12:59.221358

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "ec6b2b783199"
down_revision: Union[str, None] = "76d8ec2b5b9b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tag",
        sa.Column(
            "value",
            sa.String(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("color", sa.Integer(), primary_key=False, nullable=False),
    )

    op.create_table(
        "tasks_tags",
        sa.Column(
            "tag_value",
            sa.String(),
            sa.ForeignKey("tag.value"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("task.id"),
            primary_key=True,
            nullable=False,
        ),
    )

    op.create_table(
        "course_tasks",
        sa.Column(
            "course_id", sa.Integer(), sa.ForeignKey("course.id"), primary_key=True
        ),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("task.id"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("tag")
    op.drop_table("tasks_tags")
    op.drop_table("course_tasks")
