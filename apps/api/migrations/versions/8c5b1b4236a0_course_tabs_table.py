"""Introduce course tabs table and move tab content out of JSON

Revision ID: 8c5b1b4236a0
Revises: 5ae4d6a9b10f
Create Date: 2025-02-15 10:00:00.000000

"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8c5b1b4236a0'
down_revision: Union[str, None] = '5ae4d6a9b10f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _default_tabs() -> list[dict[str, Any]]:
    return [
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


def _default_map_state() -> dict[str, Any]:
    return {
        "objects": [],
        "boundaries": {
            "left": -1000,
            "right": 1000,
            "top": -1000,
            "bottom": 1000,
        },
    }


def upgrade() -> None:
    op.create_table(
        'course_tab',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('tab_uuid', sa.String(), nullable=False, unique=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('course.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_uuid', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('creation_date', sa.String(), nullable=False),
        sa.Column('update_date', sa.String(), nullable=False),
        sa.UniqueConstraint('course_id', 'tab_uuid', name='uq_course_tab_per_course'),
    )

    op.add_column('coursechapter_graph', sa.Column('tab_uuid', sa.String(), nullable=True))

    bind = op.get_bind()
    metadata = sa.MetaData()

    course_table = sa.Table(
        'course',
        metadata,
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('course_uuid', sa.String),
        sa.Column('tab_metadata', postgresql.JSON(astext_type=sa.Text())),
        sa.Column('tab_store', postgresql.JSON(astext_type=sa.Text())),
    )

    course_tab_table = sa.Table(
        'course_tab',
        metadata,
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tab_uuid', sa.String),
        sa.Column('course_id', sa.Integer),
        sa.Column('course_uuid', sa.String),
        sa.Column('name', sa.String),
        sa.Column('position', sa.Integer),
        sa.Column('creation_date', sa.String),
        sa.Column('update_date', sa.String),
    )

    coursechapter_graph_table = sa.Table(
        'coursechapter_graph',
        metadata,
        sa.Column('course_id', sa.Integer),
        sa.Column('chapter_id', sa.Integer),
        sa.Column('predecessor_id', sa.Integer),
        sa.Column('tab_uuid', sa.String),
    )

    coursechapter_table = sa.Table(
        'coursechapter',
        metadata,
        sa.Column('course_id', sa.Integer),
        sa.Column('chapter_id', sa.Integer),
    )

    connection = bind.connect()
    now = datetime.utcnow().isoformat()

    result = connection.execute(sa.select(course_table)).fetchall()

    for row in result:
        course_id = row.id
        course_uuid = row.course_uuid
        raw_tabs = row.tab_metadata if row.tab_metadata else None
        tabs = raw_tabs if isinstance(raw_tabs, list) and raw_tabs else _default_tabs()

        raw_store = row.tab_store if row.tab_store else {}
        store = raw_store if isinstance(raw_store, dict) else {}

        sanitized_tabs: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for index, tab in enumerate(tabs):
            if not isinstance(tab, dict):
                continue
            tab_id = str(tab.get('id') or f'tab-{index + 1}')
            if tab_id in seen_ids:
                continue
            seen_ids.add(tab_id)
            sanitized_tabs.append(
                {
                    'tab_uuid': tab_id,
                    'name': tab.get('name') or f'Tab {index + 1}',
                    'position': index,
                }
            )

        if not sanitized_tabs:
            sanitized_tabs = [
                {'tab_uuid': 'tab-1', 'name': 'Content', 'position': 0},
            ]

        for tab in sanitized_tabs:
            connection.execute(
                course_tab_table.insert().values(
                    tab_uuid=tab['tab_uuid'],
                    course_id=course_id,
                    course_uuid=course_uuid,
                    name=tab['name'],
                    position=tab['position'],
                    creation_date=now,
                    update_date=now,
                )
            )

        default_tab_uuid = sanitized_tabs[0]['tab_uuid']

        # Update coursechapter_graph rows with the default tab uuid.
        connection.execute(
            coursechapter_graph_table.update()
            .where(coursechapter_graph_table.c.course_id == course_id)
            .values(tab_uuid=default_tab_uuid)
        )

        default_map = _default_map_state()
        sanitized_store: dict[str, Any] = {}
        for tab in sanitized_tabs:
            tab_id = tab['tab_uuid']
            tab_entry = store.get(tab_id) if isinstance(store, dict) else None
            map_state = default_map
            if isinstance(tab_entry, dict):
                candidate_map = tab_entry.get('map')
                if isinstance(candidate_map, dict):
                    map_state = candidate_map
            sanitized_store[tab_id] = map_state

        connection.execute(
            course_table.update()
            .where(course_table.c.id == course_id)
            .values(tab_store=sanitized_store)
        )

        chapter_links = connection.execute(
            sa.select(coursechapter_table.c.chapter_id)
            .where(coursechapter_table.c.course_id == course_id)
        ).fetchall()
        for link in chapter_links:
            chapter_id = link.chapter_id
            base_exists = connection.execute(
                sa.select(coursechapter_graph_table.c.course_id)
                .where(coursechapter_graph_table.c.course_id == course_id)
                .where(coursechapter_graph_table.c.chapter_id == chapter_id)
                .where(coursechapter_graph_table.c.predecessor_id.is_(None))
            ).first()
            if base_exists is None:
                connection.execute(
                    coursechapter_graph_table.insert().values(
                        course_id=course_id,
                        chapter_id=chapter_id,
                        predecessor_id=None,
                        tab_uuid=default_tab_uuid,
                    )
                )

    op.alter_column('coursechapter_graph', 'tab_uuid', existing_type=sa.String(), nullable=False)
    op.create_foreign_key(
        'coursechapter_graph_tab_uuid_fkey',
        'coursechapter_graph',
        'course_tab',
        ['tab_uuid'],
        ['tab_uuid'],
        ondelete='CASCADE',
    )

    op.drop_column('course', 'tab_metadata')


def downgrade() -> None:
    op.add_column(
        'course',
        sa.Column(
            'tab_metadata',
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    bind = op.get_bind()
    metadata = sa.MetaData()

    course_table = sa.Table(
        'course',
        metadata,
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tab_metadata', postgresql.JSON(astext_type=sa.Text())),
        sa.Column('tab_store', postgresql.JSON(astext_type=sa.Text())),
    )
    course_tab_table = sa.Table(
        'course_tab',
        metadata,
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tab_uuid', sa.String()),
        sa.Column('course_id', sa.Integer()),
        sa.Column('name', sa.String()),
        sa.Column('position', sa.Integer()),
    )
    coursechapter_graph_table = sa.Table(
        'coursechapter_graph',
        metadata,
        sa.Column('course_id', sa.Integer()),
        sa.Column('tab_uuid', sa.String()),
    )

    connection = bind.connect()
    courses = connection.execute(sa.select(course_table)).fetchall()

    for course in courses:
        tabs = connection.execute(
            sa.select(course_tab_table)
            .where(course_tab_table.c.course_id == course.id)
            .order_by(course_tab_table.c.position.asc())
        ).fetchall()

        tab_metadata = [
            {
                "id": tab.tab_uuid,
                "name": tab.name,
            }
            for tab in tabs
        ]
        connection.execute(
            course_table.update()
            .where(course_table.c.id == course.id)
            .values(tab_metadata=tab_metadata)
        )

    op.drop_constraint('coursechapter_graph_tab_uuid_fkey', 'coursechapter_graph', type_='foreignkey')
    op.drop_column('coursechapter_graph', 'tab_uuid')
    op.drop_table('course_tab')
