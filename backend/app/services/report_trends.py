"""Deterministic laboratory test trend analysis across confirmed reports."""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report
from app.schemas.trends import (
    ReportTrendsResponse,
    TestComparisonPoint,
    TestDataPoint,
    TestTrendSummary,
)


def _parse_numeric_value(val_str: str | None) -> float | None:
    """Safely extract float from lab value string."""
    if not val_str:
        return None
    cleaned = val_str.strip().replace(",", "")
    match = re.search(r"[-+]?\d*\.?\d+", cleaned)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def normalize_unit(unit_str: str | None) -> str:
    """Normalize unit string for comparison."""
    if not unit_str:
        return ""
    u = unit_str.strip().lower()
    # Normalize common symbols
    u = u.replace("µ", "u").replace("μ", "u")
    u = re.sub(r"\s+", "", u)
    return u


def check_unit_compatibility(
    unit1: str | None,
    unit2: str | None,
    val2: float,
) -> tuple[bool, float | None, str | None]:
    """Check if two units can be safely compared, returning (is_compatible, converted_val2, reason).

    Converts val2 to unit1's scale if known conversion exists.
    """
    if not unit1 or not unit2:
        return False, None, "Missing unit of measurement on one or more reports"

    norm1 = normalize_unit(unit1)
    norm2 = normalize_unit(unit2)

    if norm1 == norm2:
        return True, val2, None

    # Known safe conversions: g/dL vs g/L
    if norm1 in ("g/dl", "gm/dl") and norm2 in ("g/l", "gm/l"):
        # 1 g/dL = 10 g/L -> val2 (in g/L) / 10 = val2 in g/dL
        return True, round(val2 / 10.0, 4), None
    if norm1 in ("g/l", "gm/l") and norm2 in ("g/dl", "gm/dl"):
        return True, round(val2 * 10.0, 4), None

    # mg/dL vs mg/L
    if norm1 == "mg/dl" and norm2 == "mg/l":
        return True, round(val2 / 10.0, 4), None
    if norm1 == "mg/l" and norm2 == "mg/dl":
        return True, round(val2 * 10.0, 4), None

    return False, None, f"Incompatible measurement units: '{unit1}' vs '{unit2}'"


def normalize_test_name(name: str) -> str:
    """Canonicalize common test names to group synonymous lab tests."""
    cleaned = name.strip()
    c_lower = cleaned.lower()

    if re.search(r"\b(hemoglobin|hgb|hb)\b", c_lower):
        return "Hemoglobin"
    if re.search(r"\b(platelet count|platelets|plt)\b", c_lower):
        return "Platelet Count"
    if re.search(r"\b(white blood cell|wbc|total leukocyte count|tlc)\b", c_lower):
        return "White Blood Cell Count"
    if re.search(r"\b(red blood cell|rbc|total erythrocyte count)\b", c_lower):
        return "Red Blood Cell Count"
    if re.search(r"\b(hematocrit|hct|pcv)\b", c_lower):
        return "Hematocrit (PCV)"
    if re.search(r"\b(fasting blood glucose|fasting blood sugar|fbs|glucose fasting)\b", c_lower):
        return "Fasting Blood Glucose"
    if re.search(r"\b(blood glucose|glucose|sugar)\b", c_lower):
        return "Blood Glucose"
    if re.search(r"\b(creatinine|serum creatinine)\b", c_lower):
        return "Serum Creatinine"
    if re.search(r"\b(uric acid)\b", c_lower):
        return "Uric Acid"
    if re.search(r"\b(total cholesterol)\b", c_lower):
        return "Total Cholesterol"

    return cleaned


async def compute_user_report_trends(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> ReportTrendsResponse:
    """Retrieve all confirmed reports for a user and profile and build deterministic test trends."""
    query = (
        select(Report)
        .where(
            Report.user_id == user_id, 
            Report.profile_id == profile_id, 
            Report.status.in_(["analyzed", "manually_entered"])
        )
        .order_by(Report.created_at.asc())
    )
    result = await db.execute(query)
    reports = list(result.scalars().all())

    # Map tests by canonical name
    test_buckets: dict[str, list[TestDataPoint]] = defaultdict(list)

    for report in reports:
        if not report.extracted_data or not isinstance(report.extracted_data, dict):
            continue

        raw_tests = report.extracted_data.get("tests", [])
        rep_date = report.extracted_data.get("report_date_detected")
        rep_created = report.created_at or datetime.now(timezone.utc)

        for test in raw_tests:
            if not isinstance(test, dict):
                continue
            raw_name = test.get("test_name", "")
            if not raw_name or not str(raw_name).strip():
                continue

            canonical_name = normalize_test_name(str(raw_name))
            raw_val = str(test.get("value", "")).strip()
            num_val = _parse_numeric_value(raw_val)
            unit = test.get("unit")
            ref_range = test.get("reference_range")
            status = test.get("status", "unspecified")

            point = TestDataPoint(
                report_id=report.id,
                report_filename=report.filename,
                report_date=rep_date,
                created_at=rep_created,
                raw_value=raw_val,
                numeric_value=num_val,
                unit=unit,
                reference_range=ref_range,
                status=status,
            )
            test_buckets[canonical_name].append(point)

    summaries: list[TestTrendSummary] = []

    for test_name, points in sorted(test_buckets.items(), key=lambda x: x[0]):
        # Sort data points chronologically
        points.sort(key=lambda p: p.created_at)

        comparisons: list[TestComparisonPoint] = []
        has_incomparable = False
        incomparable_reasons: list[str] = []

        for i, curr in enumerate(points):
            if i == 0:
                comparisons.append(
                    TestComparisonPoint(
                        current=curr,
                        previous=None,
                        is_comparable=True,
                        non_comparable_reason=None,
                        difference=None,
                        percent_change=None,
                        direction="unchanged",
                    )
                )
                continue

            prev = points[i - 1]

            # Check numeric validity
            if curr.numeric_value is None or prev.numeric_value is None:
                reason = "One or both test measurements are non-numeric or qualitative"
                has_incomparable = True
                incomparable_reasons.append(reason)
                comparisons.append(
                    TestComparisonPoint(
                        current=curr,
                        previous=prev,
                        is_comparable=False,
                        non_comparable_reason=reason,
                        difference=None,
                        percent_change=None,
                        direction="not_comparable",
                    )
                )
                continue

            # Check unit compatibility
            is_compat, converted_prev_val, unit_reason = check_unit_compatibility(
                curr.unit, prev.unit, prev.numeric_value
            )

            if not is_compat or converted_prev_val is None:
                has_incomparable = True
                reason = unit_reason or "Incompatible test measurement units"
                incomparable_reasons.append(reason)
                comparisons.append(
                    TestComparisonPoint(
                        current=curr,
                        previous=prev,
                        is_comparable=False,
                        non_comparable_reason=reason,
                        difference=None,
                        percent_change=None,
                        direction="not_comparable",
                    )
                )
                continue

            diff = round(curr.numeric_value - converted_prev_val, 4)
            pct_change = (
                round((diff / converted_prev_val) * 100, 2)
                if converted_prev_val != 0
                else 0.0
            )

            if diff > 0.0001:
                direction = "higher"
            elif diff < -0.0001:
                direction = "lower"
            else:
                direction = "unchanged"

            comparisons.append(
                TestComparisonPoint(
                    current=curr,
                    previous=prev,
                    is_comparable=True,
                    non_comparable_reason=None,
                    difference=diff,
                    percent_change=pct_change,
                    direction=direction,
                )
            )

        latest_status = points[-1].status if points else "unspecified"
        canonical_unit = points[-1].unit if points else None

        summaries.append(
            TestTrendSummary(
                test_name=test_name,
                canonical_unit=canonical_unit,
                data_points=points,
                comparisons=comparisons,
                latest_status=latest_status,
                has_incomparable_points=has_incomparable,
                incomparable_reasons=list(dict.fromkeys(incomparable_reasons)),
            )
        )

    return ReportTrendsResponse(
        tests=summaries,
        total_confirmed_reports=len(reports),
        tracked_tests_count=len(summaries),
    )
