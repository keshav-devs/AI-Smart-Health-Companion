"""Emergency mode router — retrieves vital emergency dossier for the active profile."""

from __future__ import annotations

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_active_profile_id, get_current_user
from app.models.contact import Contact
from app.models.medicine import Medicine
from app.models.user import User
from app.schemas.emergency import (
    EmergencyContactItem,
    EmergencyInfoResponse,
    EmergencyMedicineItem,
    EmergencyProfileInfo,
)
from app.services.profiles import get_user_profile

router = APIRouter(prefix="/emergency", tags=["emergency"])


@router.get("", response_model=EmergencyInfoResponse)
async def get_emergency_info(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmergencyInfoResponse:
    """Retrieve verified emergency dossier for the active user profile.

    Validates that the requested profile is active and belongs to the authenticated user.
    Returns emergency contacts, active medications, and stored clinical attributes (DOB, blood type, allergies).
    Unstored fields are explicitly represented as null.
    """
    profile = await get_user_profile(db, profile_id, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profile access denied.",
        )

    # 1. Emergency contacts scoped to active user and profile
    contact_stmt = (
        select(Contact)
        .where(
            Contact.user_id == current_user.id,
            Contact.profile_id == profile_id,
            Contact.contact_type == "emergency",
        )
        .order_by(Contact.created_at.asc())
    )
    contact_res = await db.execute(contact_stmt)
    contacts = contact_res.scalars().all()

    contact_items = [
        EmergencyContactItem(
            id=c.id,
            name=c.name,
            phone=c.phone,
            email=c.email,
            relationship=c.contact_relationship,
            address=c.address,
            notes=c.notes,
        )
        for c in contacts
    ]

    # 2. Active medications scoped to active user and profile
    med_stmt = (
        select(Medicine)
        .where(
            Medicine.user_id == current_user.id,
            Medicine.profile_id == profile_id,
            Medicine.is_active == True,  # noqa: E712
        )
        .order_by(Medicine.name.asc())
    )
    med_res = await db.execute(med_stmt)
    medicines = med_res.scalars().all()

    med_items = [
        EmergencyMedicineItem(
            id=m.id,
            name=m.name,
            strength=m.strength,
            form=m.form,
            instructions=m.instructions,
        )
        for m in medicines
    ]

    # 3. Profile Info (DOB, blood type, allergies if stored, else null)
    profile_info = EmergencyProfileInfo(
        id=profile.id,
        name=profile.name,
        relationship_type=profile.relationship_type,
        date_of_birth=profile.date_of_birth,
        blood_type=profile.blood_type,
        allergies=profile.allergies,
    )

    return EmergencyInfoResponse(
        profile=profile_info,
        emergency_contacts=contact_items,
        active_medicines=med_items,
        retrieved_at=datetime.now(timezone.utc),
    )

