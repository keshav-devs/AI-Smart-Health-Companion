"""Profile Pydantic schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileBase(BaseModel):
    """Shared properties for Profile."""

    name: str = Field(..., max_length=200)
    relationship_type: str = Field(..., max_length=100)
    date_of_birth: date | None = Field(default=None, description="Date of birth")
    blood_type: str | None = Field(default=None, max_length=20, description="Blood type, e.g. A+, O-, etc.")
    allergies: str | None = Field(default=None, max_length=500, description="Known allergies or sensitivities")


class ProfileCreate(ProfileBase):
    """Properties to receive on Profile creation."""

    pass


class ProfileUpdate(BaseModel):
    """Properties to receive on Profile update."""

    name: str | None = Field(None, max_length=200)
    relationship_type: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    blood_type: str | None = Field(None, max_length=20)
    allergies: str | None = Field(None, max_length=500)
    is_active: bool | None = None


class ProfileResponse(ProfileBase):
    """Properties to return for Profile."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    is_default: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
