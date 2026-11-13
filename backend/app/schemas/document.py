"""Document schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    title: str = Field(..., max_length=255)
    document_type: str = Field(..., max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    profile_id: UUID


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    document_type: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


class DocumentResponse(DocumentBase):
    id: UUID
    user_id: UUID
    filename: str
    file_size: int
    mime_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
