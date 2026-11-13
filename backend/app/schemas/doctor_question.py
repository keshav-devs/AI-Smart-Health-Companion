"""DoctorQuestion schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DoctorQuestionBase(BaseModel):
    question: str = Field(..., max_length=500)
    answer: Optional[str] = Field(None, max_length=2000)
    is_asked: bool = False
    profile_id: UUID


class DoctorQuestionCreate(DoctorQuestionBase):
    pass


class DoctorQuestionUpdate(BaseModel):
    question: Optional[str] = Field(None, max_length=500)
    answer: Optional[str] = Field(None, max_length=2000)
    is_asked: Optional[bool] = None


class DoctorQuestionResponse(DoctorQuestionBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
