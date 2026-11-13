"""Add explanation_data column to reports

Revision ID: 004_report_explanation
Revises: 003_extraction_fields
Create Date: 2026-10-08 00:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_report_explanation'
down_revision: Union[str, None] = '003_extraction_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reports', sa.Column('explanation_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('reports', 'explanation_data')
