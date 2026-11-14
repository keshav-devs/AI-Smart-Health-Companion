"""Contacts router."""

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
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse


router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactResponse:
    from app.services.profiles import get_user_profile
    if data.profile_id != profile_id:
        raise HTTPException(status_code=403, detail="Contact profile must match the active profile.")

    profile = await get_user_profile(db, profile_id, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=403, detail="Profile access denied.")

    contact = Contact(
        user_id=current_user.id,
        profile_id=profile_id,
        contact_type=data.contact_type,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        contact_relationship=data.contact_relationship,
        specialty=data.specialty,
        notes=data.notes,
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.get("", response_model=List[ContactResponse])
async def list_contacts(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ContactResponse]:
    result = await db.execute(
        select(Contact)
        .where(Contact.user_id == current_user.id, Contact.profile_id == profile_id)
        .order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()
    return [ContactResponse.model_validate(c) for c in contacts]


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactResponse:
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
            Contact.profile_id == profile_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)

    await db.commit()
    await db.refresh(contact)
    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.user_id == current_user.id,
            Contact.profile_id == profile_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found.")

    await db.delete(contact)
    await db.commit()
