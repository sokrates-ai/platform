"""Add Content Map

Revision ID: a0d67116ca3e
Revises: 0314ec7791e1
Create Date: 2024-12-30 13:12:07.149478

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a0d67116ca3e'
down_revision: Union[str, None] = '0314ec7791e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # We remove the linear order of chapters.
    with op.batch_alter_table("coursechapter") as batch_op:
        batch_op.drop_column("order")

    # Instead, we now construct a graph of chapters.
    # This table now adds predecessors to chapters.
    # If a chapter has no predecessors, it is the initial chapter.
    op.create_table(
        'coursechapter_graph',
        sa.Column('course_id', sa.Integer, primary_key=True),
        sa.Column('chapter_id', sa.Integer, primary_key=True),
        # The actual ID, not the chapter_id of the other link.
        sa.Column('predecessor_id', sa.Integer, nullable=False),
    )

    op.create_foreign_key('coursechapter_graph_fk_0', 'coursechapter_graph', 'chapter', ['predecessor_id'], ['id'])

    # TODO: decide whether we need foreign keys.
    # op.create_foreign_key(
    #         constraint_name="coursechapter_graph_fk_0",
    #         source_table="coursechapter_graph",
    #         referent_table="coursechapter",
    #         local_cols=["predecessor_id"],
    #         remote_cols=["chapter_id"])


def downgrade() -> None:
    op.drop_table('coursechapter_graph')
