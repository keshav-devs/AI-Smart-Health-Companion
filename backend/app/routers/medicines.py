"""Medicines router — CRUD, dose tracking, adherence, and reminder status."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_active_profile_id
from app.models.user import User
from app.schemas.medicine import (
    AdherenceSummary,
    DoseLogCreate,
    DoseLogResponse,
    MedicineAlertsResponse,
    MedicineCreate,
    MedicineListResponse,
    MedicineResponse,
    MedicineScheduleCreate,
    MedicineScheduleResponse,
    MedicineUpdate,
    ReminderProviderStatusResponse,
    TodayDosesResponse,
)
from app.services.medicines import (
    create_user_medicine,
    delete_user_medicine,
    get_adherence_summary,
    get_medicine_alerts,
    get_today_scheduled_doses,
    get_user_medicine,
    list_user_medicines,
    log_dose_intake,
    set_medicine_schedule,
    update_user_medicine,
)
from app.services.notifications import get_external_sms_provider, get_notification_provider

router = APIRouter(prefix="/medicines", tags=["medicines"])


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    data: MedicineCreate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineResponse:
    """Create a new medicine profile with optional schedule."""
    from app.services.profiles import get_user_profile
    profile = await get_user_profile(db, profile_id, current_user.id)
    if not profile:
        raise HTTPException(status_code=403, detail="Profile access denied.")
    
    med = await create_user_medicine(db, current_user.id, profile_id, data)
    return MedicineResponse.model_validate(med)


@router.get("", response_model=MedicineListResponse)
async def list_medicines(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    active_only: bool = Query(False, description="Filter active medicines only"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineListResponse:
    """List all medicines belonging to the authenticated user and profile."""
    meds = await list_user_medicines(db, current_user.id, profile_id, active_only=active_only)
    return MedicineListResponse(
        medicines=[MedicineResponse.model_validate(m) for m in meds],
        total=len(meds),
    )


@router.get("/alerts", response_model=MedicineAlertsResponse)
async def get_alerts(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineAlertsResponse:
    """Retrieve refill and expiry alerts across user's active medicines."""
    return await get_medicine_alerts(db, current_user.id, profile_id)


@router.get("/reminders/status", response_model=ReminderProviderStatusResponse)
async def get_reminder_status() -> ReminderProviderStatusResponse:
    """Return status of notification providers (in-app vs external delivery)."""
    external_provider = get_external_sms_provider()
    is_ext_available = external_provider.is_configured()

    msg = (
        "External SMS/WhatsApp delivery is configured and active."
        if is_ext_available
        else "External SMS/WhatsApp notification delivery is not configured. Doses are tracked and reminded in-app."
    )

    return ReminderProviderStatusResponse(
        in_app_enabled=True,
        external_delivery_available=is_ext_available,
        provider_name="Twilio / External SMS" if is_ext_available else "In-App Only",
        message=msg,
    )


@router.get("/doses/today", response_model=TodayDosesResponse)
async def get_today_doses(
    timezone: str = Query("UTC", description="Client timezone name, e.g. America/New_York"),
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TodayDosesResponse:
    """Retrieve scheduled doses for today in the user's local timezone."""
    return await get_today_scheduled_doses(db, current_user.id, profile_id, client_tz=timezone)


@router.get("/doses/history", response_model=AdherenceSummary)
async def get_adherence_history(
    days: int = Query(30, ge=1, le=365, description="Number of preceding days"),
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdherenceSummary:
    """Retrieve adherence analytics over the past N days."""
    return await get_adherence_summary(db, current_user.id, profile_id, days=days)


@router.get("/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(
    medicine_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineResponse:
    """Retrieve details of a single medicine owned by the user."""
    med = await get_user_medicine(db, medicine_id, current_user.id, profile_id)
    if med is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine not found.",
        )
    return MedicineResponse.model_validate(med)


@router.put("/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: uuid.UUID,
    data: MedicineUpdate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineResponse:
    """Update medicine fields (dosage, name, active status, threshold)."""
    med = await update_user_medicine(db, medicine_id, current_user.id, profile_id, data)
    return MedicineResponse.model_validate(med)


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicine(
    medicine_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a medicine and its associated schedules/logs."""
    await delete_user_medicine(db, medicine_id, current_user.id, profile_id)


@router.post("/{medicine_id}/schedules", response_model=MedicineScheduleResponse)
async def set_schedule(
    medicine_id: uuid.UUID,
    data: MedicineScheduleCreate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MedicineScheduleResponse:
    """Set or replace intake schedule for a medicine."""
    sched = await set_medicine_schedule(db, medicine_id, current_user.id, profile_id, data)
    return MedicineScheduleResponse.model_validate(sched)


@router.post(
    "/{medicine_id}/doses",
    response_model=DoseLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_dose(
    medicine_id: uuid.UUID,
    data: DoseLogCreate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoseLogResponse:
    """Record a scheduled dose intake as taken or skipped with deduplication."""
    log = await log_dose_intake(db, medicine_id, current_user.id, profile_id, data)
    return DoseLogResponse.model_validate(log)
