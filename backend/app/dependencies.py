"""Shared FastAPI dependencies — authentication, authorization."""

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth import decode_access_token, get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token: str | None = Query(None, description="Optional access token query parameter for file access"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the JWT from the Authorization header or query parameter.

    Returns the authenticated user or raises 401.
    """
    raw_token: str | None = None
    if credentials is not None:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    user_id = decode_access_token(raw_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    return user

import uuid

async def get_active_profile_id(
    profile_id: uuid.UUID | None = Query(None, description="Optional profile ID. Defaults to the user's primary 'Me' profile."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """Resolve the active profile ID for the request, falling back to the default profile."""
    if profile_id:
        from app.services.profiles import get_user_profile
        profile = await get_user_profile(db, profile_id, current_user.id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile access denied."
            )
        return profile_id
        
    from app.services.profiles import list_user_profiles
    profiles = await list_user_profiles(db, current_user.id)
    for p in profiles:
        if p.is_default:
            return p.id
            
    if profiles:
        return profiles[0].id
        
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="No profile found for user.",
    )
