"""Add report extraction fields

Revision ID: 003_extraction_fields
Revises: 002_create_reports
Create Date: 2026-10-07 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_extraction_fields'
down_revision: Union[str, None] = '002_create_reports'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reports', sa.Column('extracted_data', sa.JSON(), nullable=True))
    op.add_column('reports', sa.Column('extraction_error', sa.String(length=500), nullable=True))
    op.add_column('reports', sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('reports', 'reviewed_at')
    op.drop_column('reports', 'extraction_error')
    op.drop_column('reports', 'extracted_data')
