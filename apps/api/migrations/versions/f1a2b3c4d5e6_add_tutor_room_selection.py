"""Add tutor room selection

Revision ID: f1a2b3c4d5e6
Revises: 6f2c3a9b1e12
Create Date: 2026-03-18 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '6f2c3a9b1e12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'course_tutor_room_selection',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('room_id', sa.Integer(), nullable=True),
        sa.Column('creation_date', sa.String(), nullable=False),
        sa.Column('update_date', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ['course_id'],
            ['course.id'],
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['room_id'],
            ['course_room.id'],
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'user_id', name='uq_course_tutor_room_selection'),
    )


def downgrade() -> None:
    op.drop_table('course_tutor_room_selection')
