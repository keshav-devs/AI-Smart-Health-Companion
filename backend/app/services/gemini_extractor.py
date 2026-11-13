"""Gemini AI blood report extractor service.

Extracts visibly printed lab test names, values, units, and printed reference ranges.
Never diagnoses conditions or invents missing data.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings
from app.schemas.report import (
    LabTestItem,
    ReportExtractionResult,
    STANDARD_MEDICAL_DISCLAIMER,
)

logger = logging.getLogger(__name__)


class GeminiConfigurationError(Exception):
    """Raised when GEMINI_API_KEY is missing or invalid in configuration."""


class GeminiExtractionError(Exception):
    """Raised when Gemini returns malformed, unparseable, or invalid data."""


class GeminiServiceError(Exception):
    """Raised when the Gemini provider fails (network, rate limit, provider error)."""


EXTRACTION_SYSTEM_INSTRUCTION = """You are a precision medical laboratory report data extractor.
Your task is to extract test results visibly printed in the provided lab document into structured JSON.

CRITICAL MEDICAL EXTRACTION RULES:
1. EXTRACT ONLY VISIBLE DATA: Extract only test names, values, units, and reference ranges that are visibly printed in this document.
2. NEVER INVENT OR ESTIMATE: If a value, unit, or reference range is not printed, illegible, or absent, set it to null. Never substitute textbook or standard values.
3. NEVER DIAGNOSE: Do not diagnose any medical condition, illness, or syndrome (e.g. do NOT say "Patient has anemia" or "High risk of diabetes").
4. NEVER RECOMMEND TREATMENT: Do not prescribe, suggest, change, or recommend stopping any medications or therapies.
5. REFERENCE RANGE COMPARISON: Compare the observed test value to the lab's printed reference range ONLY when that range can be interpreted reliably (e.g., "12.0 - 15.5", "< 100", "> 40").
   - "normal": value is clearly within the printed range.
   - "high": value is clearly above the printed upper limit.
   - "low": value is clearly below the printed lower limit.
   - "unspecified": reference range is absent, qualitative ("Negative", "Trace"), non-numeric, or ambiguous.
6. NEEDS REVIEW: Set `needs_review: true` with a descriptive `review_reason` whenever:
   - A value or unit is faint, blurred, or partially obscured.
   - The reference range is missing, ambiguous, or complex.
   - The observed value is non-numeric or difficult to interpret reliably.

Return your response strictly as a JSON object matching this schema:
{
  "patient_name_detected": string or null,
  "report_date_detected": string or null,
  "lab_name_detected": string or null,
  "summary_notes": string or null,
  "tests": [
    {
      "test_name": string,
      "value": string,
      "unit": string or null,
      "reference_range": string or null,
      "status": "normal" | "high" | "low" | "unspecified",
      "needs_review": boolean,
      "review_reason": string or null
    }
  ]
}
"""


def interpret_range_comparison(
    value_str: str,
    range_str: str | None,
) -> tuple[str, bool, str | None]:
    """Helper to verify or normalize status and needs_review against printed range.

    Returns:
        (status, needs_review, review_reason)
    """
    if not range_str or not range_str.strip():
        return ("unspecified", True, "No printed reference range found in report")

    # Try to extract clean numeric value
    clean_val = value_str.strip().replace(",", "")
    val_match = re.search(r"[-+]?\d*\.?\d+", clean_val)
    if not val_match:
        # Qualitative value (e.g., "Negative", "Reactive", "Normal")
        return ("unspecified", True, "Qualitative or non-numeric test value")

    try:
        val = float(val_match.group(0))
    except ValueError:
        return ("unspecified", True, "Could not parse numerical value")

    clean_range = range_str.strip()

    # Pattern 1: Range "X - Y" or "X to Y"
    bounds_match = re.search(
        r"([-+]?\d*\.?\d+)\s*(?:-|–|—|to)\s*([-+]?\d*\.?\d+)", clean_range, re.IGNORECASE
    )
    if bounds_match:
        try:
            low = float(bounds_match.group(1))
            high = float(bounds_match.group(2))
            if low > high:
                low, high = high, low

            if val < low:
                return ("low", False, None)
            elif val > high:
                return ("high", False, None)
            else:
                return ("normal", False, None)
        except ValueError:
            pass

    # Pattern 2: Upper bound only "< X" or "<= X"
    upper_match = re.search(r"(?:<|<=|less than|max)\s*([-+]?\d*\.?\d+)", clean_range, re.IGNORECASE)
    if upper_match:
        try:
            limit = float(upper_match.group(1))
            if val > limit:
                return ("high", False, None)
            else:
                return ("normal", False, None)
        except ValueError:
            pass

    # Pattern 3: Lower bound only "> X" or ">= X"
    lower_match = re.search(r"(?:>|>=|greater than|min)\s*([-+]?\d*\.?\d+)", clean_range, re.IGNORECASE)
    if lower_match:
        try:
            limit = float(lower_match.group(1))
            if val < limit:
                return ("low", False, None)
            else:
                return ("normal", False, None)
        except ValueError:
            pass

    # If range is complex or unparseable
    return ("unspecified", True, "Reference range format requires manual review")


def clean_json_response(raw_text: str) -> str:
    """Extract JSON string if wrapped in markdown code blocks."""
    text = raw_text.strip()
    if text.startswith("```"):
        # Remove opening ```json or ```
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        # Remove closing ```
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def sanitize_extracted_data(data: dict[str, Any]) -> ReportExtractionResult:
    """Validate and sanitize raw dictionary into strict ReportExtractionResult."""
    # Clinical safety guardrail: check both results and tests keys
    for item in data.get("results", []) + data.get("tests", []):
        if isinstance(item, dict):
            raw_range = item.get("reference_range")
            if not raw_range or str(raw_range).strip() == "" or str(raw_range).strip().lower() == "unspecified":
                item["status"] = "unspecified"
                item["needs_review"] = True

    tests_raw = data.get("tests") or data.get("results") or []
    sanitized_tests: list[LabTestItem] = []

    for item in tests_raw:
        if not isinstance(item, dict):
            continue

        test_name = str(item.get("test_name", "")).strip()
        if not test_name:
            continue

        raw_val = str(item.get("value", "")).strip()
        raw_unit = item.get("unit")
        unit = str(raw_unit).strip() if raw_unit else None
        raw_range = item.get("reference_range")
        ref_range = str(raw_range).strip() if raw_range else None

        suggested_status = str(item.get("status", "unspecified")).lower()
        needs_review = bool(item.get("needs_review", False))
        review_reason = item.get("review_reason")

        # Double check range interpretation for precision
        calc_status, calc_review, calc_reason = interpret_range_comparison(raw_val, ref_range)

        # Respect high/low/normal if calculated reliably; otherwise mark unspecified
        final_status = calc_status if calc_status in ("normal", "high", "low") else suggested_status
        if final_status not in ("normal", "high", "low", "unspecified"):
            final_status = "unspecified"

        final_needs_review = needs_review or calc_review or (final_status == "unspecified")
        final_reason = review_reason or calc_reason if final_needs_review else None

        sanitized_tests.append(
            LabTestItem(
                test_name=test_name,
                value=raw_val,
                unit=unit,
                reference_range=ref_range,
                status=final_status,
                needs_review=final_needs_review,
                review_reason=final_reason,
            )
        )

    return ReportExtractionResult(
        patient_name_detected=data.get("patient_name_detected") or None,
        report_date_detected=data.get("report_date_detected") or None,
        lab_name_detected=data.get("lab_name_detected") or None,
        summary_notes=data.get("summary_notes") or None,
        tests=sanitized_tests,
        disclaimer=STANDARD_MEDICAL_DISCLAIMER,
    )


async def extract_report_data(
    file_bytes: bytes,
    mime_type: str,
    filename: str,
) -> ReportExtractionResult:
    """Analyze uploaded blood report with Gemini and return structured extraction.

    Raises:
        GeminiConfigurationError: If GEMINI_API_KEY is not set.
        GeminiExtractionError: If Gemini output is invalid or empty.
        GeminiServiceError: If Gemini provider fails or errors.
    """
    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        raise GeminiConfigurationError(
            "Gemini API key is not configured. Please set GEMINI_API_KEY in the backend environment."
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

        prompt = (
            f"Extract all blood test results visible in the attached file '{filename}'. "
            "Follow all rules strictly. Return only valid JSON."
        )

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[file_part, prompt],
            config=types.GenerateContentConfig(
                system_instruction=EXTRACTION_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
            ),
        )

        response_text = response.text or ""
        if not response_text.strip():
            raise GeminiExtractionError("Gemini returned an empty extraction response.")

    except (GeminiConfigurationError, GeminiExtractionError):
        raise
    except Exception as exc:
        logger.error("Gemini API call failed for file %s: %s", filename, str(exc))
        raise GeminiServiceError(
            f"AI extraction service failed: {type(exc).__name__}. Please try again later."
        ) from exc

    cleaned_json = clean_json_response(response_text)
    try:
        parsed_dict = json.loads(cleaned_json)
    except Exception as exc:
        logger.error("Failed to parse Gemini JSON output: %s", cleaned_json[:200])
        raise GeminiExtractionError("Malformed extraction response from AI provider.") from exc

    if not isinstance(parsed_dict, dict):
        raise GeminiExtractionError("Expected JSON object from AI provider.")

    try:
        result = sanitize_extracted_data(parsed_dict)
        return result
    except Exception as exc:
        logger.error("Validation of extracted data failed: %s", str(exc))
        raise GeminiExtractionError("Failed to validate extracted report data schema.") from exc
