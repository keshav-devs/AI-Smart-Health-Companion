"""Create medicines, schedules, and dose logs tables

Revision ID: 005_medicines
Revises: 004_report_explanation
Create Date: 2026-10-08 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_medicines'
down_revision: Union[str, None] = '004_report_explanation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. medicines table
    op.create_table(
        'medicines',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('strength', sa.String(length=100), nullable=True),
        sa.Column('form', sa.String(length=100), nullable=True),
        sa.Column('instructions', sa.String(length=500), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('current_quantity', sa.Integer(), nullable=True),
        sa.Column('refill_threshold', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_medicines_user_id'), 'medicines', ['user_id'], unique=False)

    # 2. medicine_schedules table
    op.create_table(
        'medicine_schedules',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('medicine_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('frequency', sa.String(length=50), nullable=False, server_default='daily'),
        sa.Column('times_per_day', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('specific_times', sa.JSON(), nullable=False),
        sa.Column('days_of_week', sa.JSON(), nullable=True),
        sa.Column('timezone', sa.String(length=100), nullable=False, server_default='UTC'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_medicine_schedules_medicine_id'), 'medicine_schedules', ['medicine_id'], unique=False)
    op.create_index(op.f('ix_medicine_schedules_user_id'), 'medicine_schedules', ['user_id'], unique=False)

    # 3. dose_logs table
    op.create_table(
        'dose_logs',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('medicine_id', sa.Uuid(), nullable=False),
        sa.Column('schedule_id', sa.Uuid(), nullable=True),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('scheduled_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actual_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['medicine_schedules.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('medicine_id', 'scheduled_time', name='uq_medicine_scheduled_time')
    )
    op.create_index(op.f('ix_dose_logs_medicine_id'), 'dose_logs', ['medicine_id'], unique=False)
    op.create_index(op.f('ix_dose_logs_schedule_id'), 'dose_logs', ['schedule_id'], unique=False)
    op.create_index(op.f('ix_dose_logs_user_id'), 'dose_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_dose_logs_scheduled_time'), 'dose_logs', ['scheduled_time'], unique=False)


def downgrade() -> None:
    op.drop_table('dose_logs')
    op.drop_table('medicine_schedules')
    op.drop_table('medicines')
