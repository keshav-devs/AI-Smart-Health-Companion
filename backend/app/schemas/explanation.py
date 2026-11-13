"""Pydantic schemas for report explanations, question answering, and limitations."""

from __future__ import annotations

import uuid
from typing import Literal
from pydantic import BaseModel, Field

from app.schemas.report import STANDARD_MEDICAL_DISCLAIMER


class TestExplanationItem(BaseModel):
    """Plain-language explanation for an individual confirmed lab test."""

    __test__ = False

    test_name: str = Field(..., description="Name of the test")
    observed_value: str = Field(..., description="The confirmed observed test value")
    unit: str | None = Field(None, description="The test measurement unit")
    reference_range: str | None = Field(None, description="The laboratory's printed reference range")
    status: Literal["normal", "high", "low", "unspecified"] = Field(
        ..., description="Comparison against the lab's printed range"
    )
    explanation: str = Field(
        ...,
        description="Plain language definition explaining what this laboratory test generally measures",
    )
    interpretation: str = Field(
        ...,
        description="Objective description of where the observed value falls relative to the lab reference range",
    )


class ReportExplanationResult(BaseModel):
    """Complete structured explanation for a confirmed blood report."""

    summary: str = Field(..., description="Plain-English summary of what the recorded values and lab ranges show")
    key_findings: list[str] = Field(
        default_factory=list,
        description="Key highlights based strictly on the reported values",
    )
    test_explanations: list[TestExplanationItem] = Field(
        default_factory=list,
        description="Detailed plain-language definitions and interpretations for each confirmed test",
    )
    limitations: str | None = Field(
        None,
        description="Plain explanation if information is incomplete or limited",
    )
    report_date: str | None = Field(None, description="Cited report collection or analysis date")
    data_points_analyzed: int = Field(0, description="Total number of confirmed tests explained")
    disclaimer: str = Field(
        default=STANDARD_MEDICAL_DISCLAIMER,
        description="Informational safety disclaimer; strictly non-diagnostic",
    )


class ReportQuestionRequest(BaseModel):
    """User question scoped to a specific confirmed report."""

    question: str = Field(
        ...,
        min_length=3,
        max_length=1000,
        description="Question regarding the confirmed test values or terminology in this report",
    )


class ReportQuestionResponse(BaseModel):
    """AI answer strictly scoped to the confirmed report."""

    question: str = Field(..., description="The user's original question")
    answer: str = Field(..., description="Plain-language educational answer strictly scoped to this report")
    cited_tests: list[str] = Field(
        default_factory=list,
        description="List of tests from this report cited or referenced in the answer",
    )
    disclaimer: str = Field(
        default=STANDARD_MEDICAL_DISCLAIMER,
        description="Informational safety disclaimer; strictly non-diagnostic",
    )
