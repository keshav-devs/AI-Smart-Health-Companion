"""Journal router."""

import uuid
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_active_profile_id
from app.models.user import User
from app.models.journal import JournalEntry
from app.schemas.journal import JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse


router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    data: JournalEntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    from app.services.profiles import get_user_profile
    profile = await get_user_profile(db, data.profile_id, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=403, detail="Profile access denied.")

    entry = JournalEntry(
        user_id=current_user.id,
        profile_id=data.profile_id,
        date=data.date,
        mood=data.mood,
        sleep_hours=data.sleep_hours,
        symptoms=data.symptoms,
        notes=data.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return JournalEntryResponse.model_validate(entry)


@router.get("", response_model=List[JournalEntryResponse])
async def list_journal_entries(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[JournalEntryResponse]:
    result = await db.execute(
        select(JournalEntry)
        .where(JournalEntry.user_id == current_user.id, JournalEntry.profile_id == profile_id)
        .order_by(JournalEntry.date.desc())
    )
    entries = result.scalars().all()
    return [JournalEntryResponse.model_validate(e) for e in entries]


@router.put("/{entry_id}", response_model=JournalEntryResponse)
async def update_journal_entry(
    entry_id: uuid.UUID,
    data: JournalEntryUpdate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JournalEntryResponse:
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
            JournalEntry.profile_id == profile_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    await db.commit()
    await db.refresh(entry)
    return JournalEntryResponse.model_validate(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entry_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JournalEntry).where(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == current_user.id,
            JournalEntry.profile_id == profile_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    await db.delete(entry)
    await db.commit()
