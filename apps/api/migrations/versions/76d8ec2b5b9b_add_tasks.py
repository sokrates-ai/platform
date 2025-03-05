"""add_tasks

Revision ID: 76d8ec2b5b9b
Revises: a0d67116ca3e
Create Date: 2025-03-05 12:40:41.854960

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa # noqa: F401
import sqlmodel # noqa: F401


# revision identifiers, used by Alembic.
revision: str = '76d8ec2b5b9b'
down_revision: Union[str, None] = 'a0d67116ca3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'course_workspace',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        sa.Column('course_id', sa.Integer, primary_key=False, nullable=False),
        sa.Column('chapter_id', sa.Integer, primary_key=False, nullable=False),
        sa.Column('task_id', sa.Integer, primary_key=False, nullable=False),
    )

    op.create_table(
        'task',
        sa.Column('id', sa.Integer, primary_key=True, nullable=False),
        # Describing attributes.
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        # Instructive attributes.
        # This is for the LLM so that it 'gets' the task.
        sa.Column('task', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('solution', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    )

    op.create_foreign_key('course_workspace_fk_0', 'course_workspace', 'task', ['task_id'], ['id'])


def downgrade() -> None:
    op.drop_table('couse_workspace')
    op.drop_table('task')
