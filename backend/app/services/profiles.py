"""Service logic for profiles."""

import uuid
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfileUpdate


async def get_user_profile(db: AsyncSession, profile_id: uuid.UUID, user_id: uuid.UUID) -> Profile | None:
    """Get a specific profile belonging to the user."""
    stmt = select(Profile).where(Profile.id == profile_id, Profile.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_user_profiles(db: AsyncSession, user_id: uuid.UUID, active_only: bool = True) -> Sequence[Profile]:
    """List profiles for a user."""
    stmt = select(Profile).where(Profile.user_id == user_id)
    if active_only:
        stmt = stmt.where(Profile.is_active == True)
    stmt = stmt.order_by(Profile.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def create_user_profile(db: AsyncSession, user_id: uuid.UUID, data: ProfileCreate) -> Profile:
    """Create a new family profile."""
    profile = Profile(
        user_id=user_id,
        name=data.name,
        relationship_type=data.relationship_type,
        date_of_birth=data.date_of_birth,
        blood_type=data.blood_type.strip() if data.blood_type else None,
        allergies=data.allergies.strip() if data.allergies else None,
        is_default=False,
        is_active=True,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_user_profile(
    db: AsyncSession, profile_id: uuid.UUID, user_id: uuid.UUID, data: ProfileUpdate
) -> Profile:
    """Update an existing profile."""
    profile = await get_user_profile(db, profile_id, user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")

    if data.name is not None:
        profile.name = data.name
    if data.relationship_type is not None:
        profile.relationship_type = data.relationship_type
    if data.date_of_birth is not None:
        profile.date_of_birth = data.date_of_birth
    if data.blood_type is not None:
        profile.blood_type = data.blood_type.strip() if data.blood_type else None
    if data.allergies is not None:
        profile.allergies = data.allergies.strip() if data.allergies else None
    
    if data.is_active is not None:
        if not data.is_active and profile.is_default:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the default 'Me' profile."
            )
        profile.is_active = data.is_active

    await db.commit()
    await db.refresh(profile)
    return profile


async def ensure_default_profile(db: AsyncSession, user_id: uuid.UUID, full_name: str) -> Profile:
    """Ensure a default 'Me' profile exists for the user."""
    stmt = select(Profile).where(Profile.user_id == user_id, Profile.is_default == True)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()
    
    if not profile:
        profile = Profile(
            user_id=user_id,
            name=full_name,
            relationship_type="Self",
            is_default=True,
            is_active=True,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
    return profile
