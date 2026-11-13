"""Medicine management, scheduling, dose logging, and adherence service."""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
import zoneinfo

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.medicine import DoseLog, Medicine, MedicineSchedule
from app.schemas.medicine import (
    AdherenceSummary,
    DoseLogCreate,
    DoseLogResponse,
    MedicineAlertsResponse,
    MedicineCreate,
    MedicineResponse,
    MedicineScheduleCreate,
    MedicineScheduleResponse,
    MedicineUpdate,
    TodayDoseItem,
    TodayDosesResponse,
)

logger = logging.getLogger(__name__)


def _get_user_zone(tz_name: str | None) -> Any:
    """Safely resolve user timezone, defaulting to UTC."""
    if not tz_name or not tz_name.strip() or tz_name.strip().upper() in ("UTC", "GMT", "Z"):
        return timezone.utc
    try:
        return zoneinfo.ZoneInfo(tz_name.strip())
    except Exception:
        return timezone.utc


def _ensure_utc(dt: datetime) -> datetime:
    """Ensure datetime is timezone-aware and in UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def get_user_medicine(
    db: AsyncSession,
    medicine_id: uuid.UUID,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> Medicine | None:
    """Fetch single medicine ensuring authenticated user ownership."""
    stmt = (
        select(Medicine)
        .where(Medicine.id == medicine_id, Medicine.user_id == user_id, Medicine.profile_id == profile_id)
        .options(selectinload(Medicine.schedules))
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_user_medicines(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    active_only: bool = False,
) -> list[Medicine]:
    """List all medicines owned by user."""
    stmt = (
        select(Medicine)
        .where(Medicine.user_id == user_id, Medicine.profile_id == profile_id)
        .options(selectinload(Medicine.schedules))
        .order_by(Medicine.name.asc())
    )
    if active_only:
        stmt = stmt.where(Medicine.is_active == True)  # noqa: E712
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_user_medicine(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    data: MedicineCreate,
) -> Medicine:
    """Create a new medicine with optional intake schedule."""
    medicine = Medicine(
        user_id=user_id,
        profile_id=profile_id,
        name=data.name.strip(),
        strength=data.strength.strip() if data.strength else None,
        form=data.form.strip() if data.form else None,
        instructions=data.instructions.strip() if data.instructions else None,
        start_date=data.start_date,
        end_date=data.end_date,
        expiry_date=data.expiry_date,
        current_quantity=data.current_quantity,
        refill_threshold=data.refill_threshold,
        is_active=data.is_active,
    )
    db.add(medicine)
    await db.flush()

    # Add initial schedule if provided
    if data.schedule:
        schedule = MedicineSchedule(
            medicine_id=medicine.id,
            user_id=user_id,
            profile_id=profile_id,
            frequency=data.schedule.frequency,
            times_per_day=data.schedule.times_per_day,
            specific_times=data.schedule.specific_times,
            days_of_week=data.schedule.days_of_week,
            timezone=data.schedule.timezone,
        )
        db.add(schedule)
        await db.flush()

    await db.commit()
    return await get_user_medicine(db, medicine.id, user_id, profile_id)  # type: ignore[return-value]


async def update_user_medicine(
    db: AsyncSession,
    medicine_id: uuid.UUID,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    data: MedicineUpdate,
) -> Medicine:
    """Update medicine fields with ownership verification."""
    medicine = await get_user_medicine(db, medicine_id, user_id, profile_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )

    if data.name is not None:
        medicine.name = data.name.strip()
    if data.strength is not None:
        medicine.strength = data.strength.strip() if data.strength else None
    if data.form is not None:
        medicine.form = data.form.strip() if data.form else None
    if data.instructions is not None:
        medicine.instructions = data.instructions.strip() if data.instructions else None
    if data.start_date is not None:
        medicine.start_date = data.start_date
    if data.end_date is not None:
        medicine.end_date = data.end_date
    if data.expiry_date is not None:
        medicine.expiry_date = data.expiry_date
    if data.current_quantity is not None:
        medicine.current_quantity = data.current_quantity
    if data.refill_threshold is not None:
        medicine.refill_threshold = data.refill_threshold
    if data.is_active is not None:
        medicine.is_active = data.is_active

    await db.commit()
    await db.refresh(medicine)
    return medicine


async def delete_user_medicine(
    db: AsyncSession,
    medicine_id: uuid.UUID,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> None:
    """Permanently delete a medicine owned by the current user."""
    medicine = await get_user_medicine(db, medicine_id, user_id, profile_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )
    await db.delete(medicine)
    await db.commit()


async def set_medicine_schedule(
    db: AsyncSession,
    medicine_id: uuid.UUID,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    data: MedicineScheduleCreate,
) -> MedicineSchedule:
    """Set or replace the intake schedule for a medicine."""
    medicine = await get_user_medicine(db, medicine_id, user_id, profile_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )

    # Delete existing schedules for this medicine
    await db.execute(
        delete(MedicineSchedule).where(MedicineSchedule.medicine_id == medicine_id)
    )

    schedule = MedicineSchedule(
        medicine_id=medicine_id,
        user_id=user_id,
        profile_id=profile_id,
        frequency=data.frequency,
        times_per_day=data.times_per_day,
        specific_times=data.specific_times,
        days_of_week=data.days_of_week,
        timezone=data.timezone,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


async def log_dose_intake(
    db: AsyncSession,
    medicine_id: uuid.UUID,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    data: DoseLogCreate,
) -> DoseLog:
    """Record a scheduled dose as taken or skipped with deduplication.

    Rule: Prevent accidental duplicate logs for the same scheduled dose.
    """
    medicine = await get_user_medicine(db, medicine_id, user_id, profile_id)
    if medicine is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )

    # Normalize scheduled_time to timezone-aware UTC with minute precision
    sched_utc = data.scheduled_time
    if sched_utc.tzinfo is None:
        sched_utc = sched_utc.replace(tzinfo=timezone.utc)
    else:
        sched_utc = sched_utc.astimezone(timezone.utc)
    sched_utc = sched_utc.replace(second=0, microsecond=0)

    # Check for duplicate dose log
    existing = await db.execute(
        select(DoseLog).where(
            DoseLog.medicine_id == medicine_id,
            DoseLog.scheduled_time == sched_utc,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A dose log already exists for this scheduled time.",
        )

    # Link schedule if available
    schedule_id = medicine.schedules[0].id if medicine.schedules else None

    actual = data.actual_time
    if actual is None:
        actual = datetime.now(timezone.utc)
    elif actual.tzinfo is None:
        actual = actual.replace(tzinfo=timezone.utc)
    else:
        actual = actual.astimezone(timezone.utc)

    dose_log = DoseLog(
        medicine_id=medicine_id,
        schedule_id=schedule_id,
        user_id=user_id,
        profile_id=profile_id,
        scheduled_time=sched_utc,
        actual_time=actual,
        status=data.status,
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(dose_log)

    # Decrement inventory if dose was taken
    if data.status == "taken" and medicine.current_quantity is not None:
        if medicine.current_quantity > 0:
            medicine.current_quantity -= 1

    await db.commit()
    await db.refresh(dose_log)
    return dose_log


async def get_today_scheduled_doses(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    client_tz: str = "UTC",
) -> TodayDosesResponse:
    """Retrieve today's scheduled doses in the user's local timezone.

    Rules:
    - Consistent timezone and date handling.
    - NEVER mark a dose 'missed' before its scheduled time has passed.
    """
    tz = _get_user_zone(client_tz)
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(tz)
    today_date = now_local.date()
    today_weekday = today_date.weekday()  # 0=Monday, 6=Sunday

    # Load all active medicines for this user
    medicines = await list_user_medicines(db, user_id, profile_id, active_only=True)

    today_items: list[TodayDoseItem] = []

    # Get start and end of today in UTC
    day_start_local = datetime.combine(today_date, time.min, tzinfo=tz)
    day_end_local = datetime.combine(today_date, time.max, tzinfo=tz)
    day_start_utc = day_start_local.astimezone(timezone.utc)
    day_end_utc = day_end_local.astimezone(timezone.utc)

    # Pre-fetch today's dose logs for this user and profile
    log_stmt = select(DoseLog).where(
        DoseLog.user_id == user_id,
        DoseLog.profile_id == profile_id,
        DoseLog.scheduled_time >= day_start_utc,
        DoseLog.scheduled_time <= day_end_utc,
    )
    log_res = await db.execute(log_stmt)
    today_logs = list(log_res.scalars().all())

    # Map logs by (medicine_id, scheduled_time_utc)
    logs_map: dict[tuple[uuid.UUID, datetime], DoseLog] = {
        (log.medicine_id, _ensure_utc(log.scheduled_time).replace(second=0, microsecond=0)): log
        for log in today_logs
    }

    for med in medicines:
        # Check active date boundaries
        if med.start_date and med.start_date > today_date:
            continue
        if med.end_date and med.end_date < today_date:
            continue

        for sched in med.schedules:
            # Check days of week if constrained
            if sched.days_of_week is not None and today_weekday not in sched.days_of_week:
                continue

            for t_str in sched.specific_times:
                try:
                    parts = t_str.split(":")
                    hour = int(parts[0])
                    minute = int(parts[1])
                    dose_time_local = datetime.combine(
                        today_date, time(hour, minute), tzinfo=tz
                    )
                except Exception:
                    continue

                dose_time_utc = dose_time_local.astimezone(timezone.utc).replace(second=0, microsecond=0)

                # Check if logged
                matched_log = logs_map.get((med.id, dose_time_utc))

                if matched_log:
                    status_str = matched_log.status  # "taken" | "skipped"
                    log_id = matched_log.id
                    logged_at = _ensure_utc(matched_log.actual_time or matched_log.created_at).isoformat()
                    log_notes = matched_log.notes
                else:
                    log_id = None
                    logged_at = None
                    log_notes = None
                    # Never mark missed before scheduled time has passed!
                    if now_local < dose_time_local:
                        status_str = "pending"
                    else:
                        # Scheduled time has passed without log
                        # If within 30 minutes, mark as due; after 30 minutes, missed
                        time_since = (now_local - dose_time_local).total_seconds()
                        if time_since <= 1800:
                            status_str = "due"
                        else:
                            status_str = "missed"

                today_items.append(
                    TodayDoseItem(
                        medicine_id=med.id,
                        medicine_name=med.name,
                        strength=med.strength,
                        form=med.form,
                        instructions=med.instructions,
                        scheduled_time=dose_time_utc,
                        time_str=t_str,
                        status=status_str,  # type: ignore[arg-type]
                        dose_log_id=log_id,
                        logged_at=logged_at,
                        notes=log_notes,
                    )
                )

    # Sort doses by time
    today_items.sort(key=lambda d: d.scheduled_time)

    taken_c = sum(1 for d in today_items if d.status == "taken")
    skipped_c = sum(1 for d in today_items if d.status == "skipped")
    pending_c = sum(1 for d in today_items if d.status in ("pending", "due"))
    missed_c = sum(1 for d in today_items if d.status == "missed")

    return TodayDosesResponse(
        date=today_date.isoformat(),
        timezone=str(tz),
        doses=today_items,
        total_doses=len(today_items),
        taken_count=taken_c,
        skipped_count=skipped_c,
        pending_count=pending_c,
        missed_count=missed_c,
    )


async def get_adherence_summary(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    days: int = 30,
) -> AdherenceSummary:
    """Calculate intake adherence over the preceding N days."""
    now_utc = datetime.now(timezone.utc)
    start_utc = now_utc - timedelta(days=days)

    stmt = select(DoseLog).where(
        DoseLog.user_id == user_id,
        DoseLog.profile_id == profile_id,
        DoseLog.scheduled_time >= start_utc,
        DoseLog.scheduled_time <= now_utc,
    )
    res = await db.execute(stmt)
    logs = list(res.scalars().all())

    taken = sum(1 for l in logs if l.status == "taken")
    skipped = sum(1 for l in logs if l.status == "skipped")
    # For logs, total logged is taken + skipped
    total_logged = len(logs)
    rate = round((taken / total_logged) * 100, 1) if total_logged > 0 else 100.0

    return AdherenceSummary(
        days=days,
        total_scheduled=total_logged,
        taken=taken,
        skipped=skipped,
        missed=0,
        adherence_rate_percent=rate,
    )


async def get_medicine_alerts(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> MedicineAlertsResponse:
    """Return medicines needing refill or nearing expiry."""
    today = date.today()
    soon_cutoff = today + timedelta(days=30)

    meds = await list_user_medicines(db, user_id, profile_id, active_only=True)

    low_refill: list[MedicineResponse] = []
    expiring_soon: list[MedicineResponse] = []
    expired: list[MedicineResponse] = []

    for m in meds:
        m_resp = MedicineResponse.model_validate(m)

        # Refill check
        if m.current_quantity is not None and m.refill_threshold is not None:
            if m.current_quantity <= m.refill_threshold:
                low_refill.append(m_resp)

        # Expiry check
        if m.expiry_date:
            if m.expiry_date < today:
                expired.append(m_resp)
            elif today <= m.expiry_date <= soon_cutoff:
                expiring_soon.append(m_resp)

    return MedicineAlertsResponse(
        low_refill=low_refill,
        expiring_soon=expiring_soon,
        expired=expired,
    )
