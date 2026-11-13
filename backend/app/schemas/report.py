"""Pydantic schemas for report endpoints and AI extraction."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


STANDARD_MEDICAL_DISCLAIMER = (
    "This extraction was performed by AI from your uploaded lab report for personal reference only. "
    "It is not a medical diagnosis or clinical advice. Do not change, adjust, or discontinue any "
    "medications or treatments without consulting your healthcare provider."
)


class LabTestItem(BaseModel):
    """A single lab test item extracted from a blood report."""

    test_name: str = Field(..., description="Name of the test visibly printed in the report (e.g. Hemoglobin)")
    value: str = Field(..., description="Observed test value (e.g. '14.2', 'Normal')")
    unit: str | None = Field(None, description="Measurement unit (e.g. 'g/dL', 'mg/dL')")
    reference_range: str | None = Field(None, description="Reference range visibly printed by this lab (e.g. '12.0 - 15.5')")
    status: Literal["normal", "high", "low", "unspecified"] = Field(
        "unspecified",
        description="Comparison against the printed reference range only"
    )
    needs_review: bool = Field(
        False,
        description="True if the value or range is uncertain, unreadable, or missing"
    )
    review_reason: str | None = Field(
        None,
        description="Explanation if this item was flagged as needing manual review"
    )


class ReportExtractionResult(BaseModel):
    """Structured extraction output from blood report."""

    patient_name_detected: str | None = Field(None, description="Patient name if clearly visible")
    report_date_detected: str | None = Field(None, description="Report collection/result date if clearly visible")
    lab_name_detected: str | None = Field(None, description="Laboratory or clinic name if clearly visible")
    tests: list[LabTestItem] = Field(default_factory=list, description="List of extracted test measurements")
    disclaimer: str = Field(
        default=STANDARD_MEDICAL_DISCLAIMER,
        description="Standard informational safety disclaimer"
    )
    summary_notes: str | None = Field(
        None,
        description="Brief objective notes on extraction quality (no diagnosis)"
    )
    provenance: Literal["ai", "manual"] = Field(
        default="ai",
        description="Source of this extracted data (AI or manually entered)"
    )


class ConfirmExtractionRequest(BaseModel):
    """User-confirmed and potentially edited test results."""

    tests: list[LabTestItem] = Field(..., description="User-reviewed list of test items")
    patient_name_detected: str | None = None
    report_date_detected: str | None = None
    lab_name_detected: str | None = None
    notes: str | None = None


class ReportResponse(BaseModel):
    """Public representation of a report."""

    id: uuid.UUID
    user_id: uuid.UUID
    profile_id: uuid.UUID
    filename: str
    report_type: str | None = None
    mime_type: str
    file_size: int
    status: str
    extracted_data: ReportExtractionResult | None = None
    explanation_data: dict | None = None
    extraction_error: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportListResponse(BaseModel):
    """Paginated or listed collection of reports."""

    reports: list[ReportResponse]
    total: int
