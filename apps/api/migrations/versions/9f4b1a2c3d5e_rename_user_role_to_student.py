"""Rename User role to Student

Revision ID: 9f4b1a2c3d5e
Revises: 6f2c3a9b1e12
Create Date: 2026-04-14 13:37:49

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f4b1a2c3d5e"
down_revision: Union[str, None] = "6f2c3a9b1e12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()

    role_table = sa.Table(
        "role",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("role_uuid", sa.String),
        sa.Column("name", sa.String),
        sa.Column("description", sa.String),
    )

    user_org_table = sa.Table(
        "userorganization",
        metadata,
        sa.Column("role_id", sa.Integer),
    )

    old_id = bind.execute(
        sa.select(role_table.c.id).where(
            role_table.c.role_uuid == "role_global_user"
        )
    ).scalar()
    student_id = bind.execute(
        sa.select(role_table.c.id).where(
            role_table.c.role_uuid == "role_global_student"
        )
    ).scalar()

    if old_id and student_id and student_id != old_id:
        bind.execute(
            user_org_table.update()
            .where(user_org_table.c.role_id == student_id)
            .values(role_id=old_id)
        )
        bind.execute(role_table.delete().where(role_table.c.id == student_id))

    if old_id:
        bind.execute(
            role_table.update()
            .where(role_table.c.id == old_id)
            .values(
                role_uuid="role_global_student",
                name="Student",
                description="Standard Student Role",
            )
        )
    elif student_id:
        bind.execute(
            role_table.update()
            .where(role_table.c.id == student_id)
            .values(
                name="Student",
                description="Standard Student Role",
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()

    role_table = sa.Table(
        "role",
        metadata,
        sa.Column("id", sa.Integer),
        sa.Column("role_uuid", sa.String),
        sa.Column("name", sa.String),
        sa.Column("description", sa.String),
    )

    bind.execute(
        role_table.update()
        .where(role_table.c.role_uuid == "role_global_student")
        .values(
            role_uuid="role_global_user",
            name="User",
            description="Standard User Role",
        )
    )
