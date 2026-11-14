"""Request and response schemas for patient-facing AI features."""

from pydantic import BaseModel, Field

from app.schemas.report import STANDARD_MEDICAL_DISCLAIMER


class HealthChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class HealthChatResponse(BaseModel):
    answer: str = Field(..., min_length=1, max_length=6000)
    emergency: bool = False
    disclaimer: str = STANDARD_MEDICAL_DISCLAIMER


class DoctorQuestionSuggestionsResponse(BaseModel):
    suggestions: list[str] = Field(default_factory=list, max_length=8)
    disclaimer: str = STANDARD_MEDICAL_DISCLAIMER
