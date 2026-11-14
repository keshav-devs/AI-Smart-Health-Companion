"""add_emergency_fields_to_profiles

Revision ID: feee35b402d1
Revises: 98e78ab2c4c4
Create Date: 2026-11-14 17:46:27.775175

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'feee35b402d1'
down_revision: Union[str, None] = '98e78ab2c4c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('date_of_birth', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('blood_type', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('allergies', sa.String(length=500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('profiles', schema=None) as batch_op:
        batch_op.drop_column('allergies')
        batch_op.drop_column('blood_type')
        batch_op.drop_column('date_of_birth')
