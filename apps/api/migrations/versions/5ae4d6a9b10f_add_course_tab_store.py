"""Add course tab metadata and store

Revision ID: 5ae4d6a9b10f
Revises: a0d67116ca3e
Create Date: 2025-02-14 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlmodel  # noqa: F401
import json


# revision identifiers, used by Alembic.
revision: str = '5ae4d6a9b10f'
down_revision: Union[str, None] = 'ae_add_rewards_to_chapter'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'course',
        sa.Column(
            'tab_metadata',
            sa.JSON,
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column(
        'course',
        sa.Column(
            'tab_store',
            sa.JSON,
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )

    default_metadata = [
        {
            "id": "tab-1",
            "name": "Content",
            "description": "Organize chapters and activities for this course.",
        },
        {
            "id": "tab-2",
            "name": "Map",
            "description": "Design the spatial course map for learners.",
        },
    ]

    default_map = {
        "objects": [],
        "boundaries": {
            "left": -1000,
            "right": 1000,
            "top": -1000,
            "bottom": 1000,
        },
    }

    op.execute(
        sa.text(
            """
            UPDATE course
            SET tab_metadata = :metadata::json,
                tab_store = json_build_object(
                    'tab-1', json_build_object(
                        'map', COALESCE(map_state, :default_map::json),
                        'content', json_build_object('chapters', '[]'::json)
                    ),
                    'tab-2', json_build_object(
                        'map', COALESCE(map_state, :default_map::json),
                        'content', json_build_object('chapters', '[]'::json)
                    )
                )
            """
        ),
        {
            "metadata": json.dumps(default_metadata),
            "default_map": json.dumps(default_map),
        },
    )

    op.alter_column(
        'course',
        'tab_metadata',
        existing_type=sa.JSON,
        server_default=None,
    )
    op.alter_column(
        'course',
        'tab_store',
        existing_type=sa.JSON,
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column('course', 'tab_store')
    op.drop_column('course', 'tab_metadata')
