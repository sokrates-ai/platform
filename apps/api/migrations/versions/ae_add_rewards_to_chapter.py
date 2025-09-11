"""
add rewards to chapter

Revision ID: ae_add_rewards_to_chapter
Revises: f70bacaa06e5
Create Date: 2025-09-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ae_add_rewards_to_chapter'
down_revision: Union[str, None] = 'f70bacaa06e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('chapter') as batch_op:
        batch_op.add_column(sa.Column('xp_reward', sa.Integer(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('coin_reward', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('chapter') as batch_op:
        batch_op.drop_column('coin_reward')
        batch_op.drop_column('xp_reward') 