"""Pydantic schemas for medicine management, dose tracking, and reminders."""

from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class MedicineScheduleBase(BaseModel):
    """Base intake schedule."""

    frequency: Literal["daily", "twice_daily", "custom", "as_needed"] = "daily"
    times_per_day: int = Field(1, ge=1, le=12)
    specific_times: list[str] = Field(
        default_factory=lambda: ["08:00"],
        description="Times of day in 24h HH:MM format",
    )
    days_of_week: list[int] | None = Field(
        None,
        description="Days of week (0=Mon, 6=Sun) or null for every day",
    )
    timezone: str = Field("UTC", max_length=100)

    @field_validator("specific_times")
    @classmethod
    def validate_time_formats(cls, times: list[str]) -> list[str]:
        time_regex = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
        cleaned: list[str] = []
        for t in times:
            t_str = t.strip()
            if not time_regex.match(t_str):
                raise ValueError(f"Invalid time format '{t}'. Must be HH:MM in 24-hour format.")
            cleaned.append(t_str)
        return sorted(list(set(cleaned)))


class MedicineScheduleCreate(MedicineScheduleBase):
    """Create schedule payload."""
    pass


class MedicineScheduleUpdate(MedicineScheduleBase):
    """Update schedule payload."""
    pass


class MedicineScheduleResponse(MedicineScheduleBase):
    """Schedule response."""

    id: uuid.UUID
    medicine_id: uuid.UUID
    user_id: uuid.UUID
    profile_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineBase(BaseModel):
    """Base fields for medicine."""

    name: str = Field(..., min_length=1, max_length=200)
    strength: str | None = Field(None, max_length=100)
    form: str | None = Field(None, max_length=100)  # Tablet, Capsule, Liquid, Inhaler, etc.
    instructions: str | None = Field(None, max_length=500)
    start_date: date | None = None
    end_date: date | None = None
    expiry_date: date | None = None
    current_quantity: int | None = Field(None, ge=0)
    refill_threshold: int | None = Field(None, ge=0)
    is_active: bool = True


class MedicineCreate(MedicineBase):
    """Payload to create a new medicine with optional schedule."""

    schedule: MedicineScheduleCreate | None = None


class MedicineUpdate(BaseModel):
    """Payload to update an existing medicine."""

    name: str | None = Field(None, min_length=1, max_length=200)
    strength: str | None = Field(None, max_length=100)
    form: str | None = Field(None, max_length=100)
    instructions: str | None = Field(None, max_length=500)
    start_date: date | None = None
    end_date: date | None = None
    expiry_date: date | None = None
    current_quantity: int | None = Field(None, ge=0)
    refill_threshold: int | None = Field(None, ge=0)
    is_active: bool | None = None


class MedicineResponse(MedicineBase):
    """Public representation of a medicine."""

    id: uuid.UUID
    user_id: uuid.UUID
    profile_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    schedules: list[MedicineScheduleResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MedicineListResponse(BaseModel):
    """List of user medicines."""

    medicines: list[MedicineResponse]
    total: int


class DoseLogCreate(BaseModel):
    """Record an intake event for a scheduled dose."""

    scheduled_time: datetime = Field(..., description="The scheduled ISO datetime")
    actual_time: datetime | None = Field(None, description="Actual intake ISO datetime")
    status: Literal["taken", "skipped"] = Field(..., description="Whether dose was taken or skipped")
    notes: str | None = Field(None, max_length=500)


class DoseLogResponse(BaseModel):
    """Recorded dose entry."""

    id: uuid.UUID
    medicine_id: uuid.UUID
    schedule_id: uuid.UUID | None
    user_id: uuid.UUID
    profile_id: uuid.UUID
    scheduled_time: datetime
    actual_time: datetime | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TodayDoseItem(BaseModel):
    """A scheduled dose item for the current day."""

    medicine_id: uuid.UUID
    medicine_name: str
    strength: str | None
    form: str | None
    instructions: str | None
    scheduled_time: datetime
    time_str: str  # "08:00"
    status: Literal["pending", "due", "taken", "skipped", "missed"]
    dose_log_id: uuid.UUID | None = None
    logged_at: datetime | None = None
    notes: str | None = None


class TodayDosesResponse(BaseModel):
    """Today's scheduled doses and current adherence overview."""

    date: str  # YYYY-MM-DD
    timezone: str
    doses: list[TodayDoseItem]
    total_doses: int
    taken_count: int
    skipped_count: int
    pending_count: int
    missed_count: int


class AdherenceSummary(BaseModel):
    """Adherence analytics over a selected period."""

    days: int
    total_scheduled: int
    taken: int
    skipped: int
    missed: int
    adherence_rate_percent: float


class MedicineAlertsResponse(BaseModel):
    """Refill and expiry notifications for user's medicines."""

    low_refill: list[MedicineResponse]
    expiring_soon: list[MedicineResponse]
    expired: list[MedicineResponse]


class ReminderProviderStatusResponse(BaseModel):
    """Status of notification delivery integration."""

    in_app_enabled: bool = True
    external_delivery_available: bool = False
    provider_name: str = "In-App Only"
    message: str = "External SMS/WhatsApp notification delivery is not configured. Doses are tracked and reminded in-app."
