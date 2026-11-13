"""Contact schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ContactBase(BaseModel):
    contact_type: str = Field(..., max_length=50) # emergency, doctor, specialist
    name: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    contact_relationship: Optional[str] = Field(None, max_length=100)
    specialty: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    profile_id: UUID


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    contact_type: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    contact_relationship: Optional[str] = Field(None, max_length=100)
    specialty: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


class ContactResponse(ContactBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
