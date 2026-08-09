"""Add indexes for course browsing and map/trail lookups.

Revision ID: e4f5a6b7c8d9
Revises: d7f8a9b0c1d2
Create Date: 2026-08-09 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, None] = "d7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("ix_course_course_uuid", "course", ["course_uuid"]),
    ("ix_resourceauthor_resource_uuid", "resourceauthor", ["resource_uuid"]),
    ("ix_course_tab_course_position", "course_tab", ["course_id", "position", "id"]),
    ("ix_coursechapter_course_chapter", "coursechapter", ["course_id", "chapter_id"]),
    ("ix_coursechapter_graph_course_chapter", "coursechapter_graph", ["course_id", "chapter_id"]),
    ("ix_chapteractivity_chapter_order", "chapteractivity", ["chapter_id", "order"]),
    ("ix_activity_course_id", "activity", ["course_id"]),
    ("ix_usergroupresource_resource_group", "usergroupresource", ["resource_uuid", "usergroup_id"]),
    ("ix_usergroupuser_user_group", "usergroupuser", ["user_id", "usergroup_id"]),
)


def upgrade() -> None:
    for index_name, table_name, columns in INDEXES:
        op.create_index(index_name, table_name, columns)


def downgrade() -> None:
    for index_name, table_name, _ in reversed(INDEXES):
        op.drop_index(index_name, table_name=table_name)
