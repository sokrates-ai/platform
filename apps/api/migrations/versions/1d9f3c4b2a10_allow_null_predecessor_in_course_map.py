"""Allow nullable predecessors in course chapter graph

Revision ID: 1d9f3c4b2a10
Revises: f70bacaa06e5
Create Date: 2025-03-04 12:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d9f3c4b2a10'
down_revision: str | None = 'f70bacaa06e5'
branch_labels: tuple[str, ...] | None = None
depends_on: tuple[str, ...] | None = None


def upgrade() -> None:
    op.drop_constraint('coursechapter_graph_pkey', 'coursechapter_graph', type_='primary')

    op.add_column('coursechapter_graph', sa.Column('id', sa.Integer(), nullable=True))

    op.execute(sa.text("CREATE SEQUENCE IF NOT EXISTS coursechapter_graph_id_seq"))
    op.execute(sa.text("ALTER SEQUENCE coursechapter_graph_id_seq OWNED BY coursechapter_graph.id"))
    op.execute(sa.text("UPDATE coursechapter_graph SET id = nextval('coursechapter_graph_id_seq') WHERE id IS NULL"))

    op.alter_column(
        'coursechapter_graph',
        'id',
        server_default=sa.text("nextval('coursechapter_graph_id_seq')"),
        nullable=False,
    )

    op.alter_column(
        'coursechapter_graph',
        'predecessor_id',
        existing_type=sa.INTEGER(),
        nullable=True,
    )

    op.create_primary_key('coursechapter_graph_pkey', 'coursechapter_graph', ['id'])


def downgrade() -> None:
    op.drop_constraint('coursechapter_graph_pkey', 'coursechapter_graph', type_='primary')

    op.alter_column('coursechapter_graph', 'id', server_default=None)

    op.execute(sa.text("ALTER SEQUENCE coursechapter_graph_id_seq OWNED BY NONE"))
    op.execute(sa.text("DROP SEQUENCE IF EXISTS coursechapter_graph_id_seq"))

    op.drop_column('coursechapter_graph', 'id')

    op.alter_column(
        'coursechapter_graph',
        'predecessor_id',
        existing_type=sa.INTEGER(),
        nullable=False,
    )

    op.create_primary_key(
        'coursechapter_graph_pkey',
        'coursechapter_graph',
        ['course_id', 'chapter_id', 'predecessor_id'],
    )
