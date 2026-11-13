"""Journal schemas."""

from datetime import date as dt_date, datetime as dt_datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


class JournalEntryBase(BaseModel):
    date: dt_date
    mood: Optional[str] = Field(None, max_length=50)
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    symptoms: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=2000)
    profile_id: UUID


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntryUpdate(BaseModel):
    date: Optional[dt_date] = None
    mood: Optional[str] = Field(None, max_length=50)
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    symptoms: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=2000)


class JournalEntryResponse(JournalEntryBase):
    id: UUID
    user_id: UUID
    created_at: dt_datetime
    updated_at: dt_datetime

    class Config:
        from_attributes = True

