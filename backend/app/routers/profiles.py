"""Profiles router — manage family member profiles."""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate
from app.services.profiles import (
    create_user_profile,
    get_user_profile,
    list_user_profiles,
    update_user_profile,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Create a new profile."""
    profile = await create_user_profile(db, current_user.id, data)
    return ProfileResponse.model_validate(profile)


@router.get("", response_model=list[ProfileResponse])
async def list_profiles(
    active_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProfileResponse]:
    """List profiles for the user."""
    profiles = await list_user_profiles(db, current_user.id, active_only)
    return [ProfileResponse.model_validate(p) for p in profiles]


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: uuid.UUID,
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Update or deactivate a profile."""
    profile = await update_user_profile(db, profile_id, current_user.id, data)
    return ProfileResponse.model_validate(profile)
