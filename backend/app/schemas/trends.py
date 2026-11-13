"""Pydantic schemas for report trends and chronological comparison across reports."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

from app.schemas.report import STANDARD_MEDICAL_DISCLAIMER


class TestDataPoint(BaseModel):
    """A single observed measurement in a user's confirmed report history."""

    __test__ = False

    report_id: uuid.UUID
    report_filename: str
    report_date: str | None = Field(None, description="Report date or created date")
    created_at: datetime
    raw_value: str
    numeric_value: float | None = None
    unit: str | None = None
    reference_range: str | None = None
    status: str


class TestComparisonPoint(BaseModel):
    """Comparison of a data point against the preceding chronological data point."""

    __test__ = False

    current: TestDataPoint
    previous: TestDataPoint | None = None
    is_comparable: bool
    non_comparable_reason: str | None = None
    difference: float | None = None
    percent_change: float | None = None
    direction: Literal["higher", "lower", "unchanged", "not_comparable"] = "not_comparable"


class TestTrendSummary(BaseModel):
    """Aggregated chronological trajectory of a specific recognized test."""

    __test__ = False

    test_name: str
    canonical_unit: str | None = None
    data_points: list[TestDataPoint] = Field(default_factory=list)
    comparisons: list[TestComparisonPoint] = Field(default_factory=list)
    latest_status: str = "unspecified"
    has_incomparable_points: bool = False
    incomparable_reasons: list[str] = Field(default_factory=list)


class ReportTrendsResponse(BaseModel):
    """List of all recognized laboratory tests tracked across confirmed reports."""

    tests: list[TestTrendSummary]
    total_confirmed_reports: int
    tracked_tests_count: int
    disclaimer: str = STANDARD_MEDICAL_DISCLAIMER
