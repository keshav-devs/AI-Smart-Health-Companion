"""Emergency information schemas."""

from __future__ import annotations

from datetime import date, datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class EmergencyContactItem(BaseModel):
    """Emergency contact summary for responders."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None = None
    relationship: str | None = None
    address: str | None = None
    notes: str | None = None


class EmergencyMedicineItem(BaseModel):
    """Active prescription/medicine item."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    strength: str | None = None
    form: str | None = None
    instructions: str | None = None


class EmergencyProfileInfo(BaseModel):
    """Profile identity and core emergency medical attributes."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    relationship_type: str
    date_of_birth: date | None = None
    blood_type: str | None = None
    allergies: str | None = None


class EmergencyInfoResponse(BaseModel):
    """Complete emergency dossier for the active profile."""

    profile: EmergencyProfileInfo
    emergency_contacts: list[EmergencyContactItem] = Field(default_factory=list)
    active_medicines: list[EmergencyMedicineItem] = Field(default_factory=list)
    retrieved_at: datetime
    disclaimer: str = (
        "Emergency medical summary for clinical and first-responder reference only. "
        "Missing attributes (such as allergies, blood type, or conditions) must be treated as "
        "not provided / unrecorded, never inferred to be absent."
    )

