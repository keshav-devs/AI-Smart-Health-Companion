"""Medicine, schedule, and dose tracking ORM models."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.profile import Profile


class Medicine(Base):
    """User-owned medicine profile."""

    __tablename__ = "medicines"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    strength: Mapped[str | None] = mapped_column(String(100), nullable=True)
    form: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Tablet, Capsule, Liquid, etc.
    instructions: Mapped[str | None] = mapped_column(String(500), nullable=True)  # With food, bedtime, etc.
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    refill_threshold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped["User"] = relationship("User", back_populates="medicines")
    profile: Mapped["Profile"] = relationship("Profile", back_populates="medicines")
    schedules: Mapped[list["MedicineSchedule"]] = relationship(
        "MedicineSchedule", back_populates="medicine", cascade="all, delete-orphan"
    )
    dose_logs: Mapped[list["DoseLog"]] = relationship(
        "DoseLog", back_populates="medicine", cascade="all, delete-orphan"
    )


class MedicineSchedule(Base):
    """Configured intake schedule for a medicine."""

    __tablename__ = "medicine_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    frequency: Mapped[str] = mapped_column(String(50), nullable=False, default="daily")  # daily, twice_daily, custom, as_needed
    times_per_day: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    specific_times: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)  # ["08:00", "20:00"]
    days_of_week: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)  # [0, 1, 2, 3, 4, 5, 6] or None for all
    timezone: Mapped[str] = mapped_column(String(100), default="UTC", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="schedules")
    profile: Mapped["Profile"] = relationship("Profile", back_populates="medicine_schedules")


class DoseLog(Base):
    """Recorded intake event (taken or skipped)."""

    __tablename__ = "dose_logs"
    __table_args__ = (
        UniqueConstraint("medicine_id", "scheduled_time", name="uq_medicine_scheduled_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("medicines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("medicine_schedules.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheduled_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    actual_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # taken, skipped
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    medicine: Mapped["Medicine"] = relationship("Medicine", back_populates="dose_logs")
    profile: Mapped["Profile"] = relationship("Profile", back_populates="dose_logs")
