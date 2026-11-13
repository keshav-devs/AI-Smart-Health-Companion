"""Gemini implementation of AIExplanationProvider."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings
from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
    TestExplanationItem,
)
from app.schemas.report import ReportExtractionResult, STANDARD_MEDICAL_DISCLAIMER
from app.services.ai.base import (
    AIConfigurationError,
    AIExplanationProvider,
    AIParseError,
    AIServiceError,
)

logger = logging.getLogger(__name__)

EXPLANATION_SYSTEM_INSTRUCTION = """You are a medical laboratory educator providing clear, safe explanations of confirmed lab reports to patients.

CRITICAL SAFETY & EDUCATIONAL RULES:
1. Strictly Informational: Explain what tests measure and define medical terms in plain, easy-to-understand English.
2. Rely Strictly On Provided Data: Use ONLY the test names, values, units, reference ranges, and statuses provided in the prompt. Do not invent missing tests or reference ranges.
3. NEVER DIAGNOSE: Do not diagnose any condition, illness, or disease (e.g. do not say "You have anemia" or "This indicates diabetes").
4. NEVER RECOMMEND TREATMENT: Do not advise starting, stopping, increasing, or decreasing any medication, supplement, or medical therapy.
5. Incomplete Data: If the report lacks enough information to explain a particular test, state that plainly in the limitations.
6. Always defer to licensed healthcare providers.

Return your response strictly as valid JSON matching this schema:
{
  "summary": string,
  "key_findings": [string],
  "test_explanations": [
    {
      "test_name": string,
      "observed_value": string,
      "unit": string or null,
      "reference_range": string or null,
      "status": "normal" | "high" | "low" | "unspecified",
      "explanation": string,
      "interpretation": string
    }
  ],
  "limitations": string or null
}
"""

QUESTION_SYSTEM_INSTRUCTION = """You are a medical laboratory educator answering patient questions strictly about their confirmed blood report.

CRITICAL RULES:
1. Keep the answer strictly scoped to the test names, values, units, and ranges provided from this report.
2. Define medical terms and explain test functions in simple language.
3. Do not diagnose conditions or recommend medications or changes to treatment.
4. If the question asks for information not present in the report or asks for medical advice/diagnosis, clearly explain that this cannot be determined from the report and advise consulting a healthcare professional.

Return your response strictly as valid JSON matching this schema:
{
  "answer": string,
  "cited_tests": [string]
}
"""


def _clean_json_str(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


class GeminiAIProvider(AIExplanationProvider):
    """Google Gemini AI implementation for report explanations and Q&A."""

    def _ensure_configured(self) -> None:
        if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
            raise AIConfigurationError(
                "AI explanation is not configured yet. GEMINI_API_KEY is not set in backend configuration."
            )

    async def explain_report(
        self,
        extraction: ReportExtractionResult,
        report_date: str | None = None,
    ) -> ReportExplanationResult:
        self._ensure_configured()

        tests_data = [
            {
                "test_name": t.test_name,
                "value": t.value,
                "unit": t.unit,
                "reference_range": t.reference_range,
                "status": t.status,
            }
            for t in extraction.tests
        ]

        prompt = (
            f"Please explain the following confirmed blood test results from report dated {report_date or 'N/A'}:\n"
            f"{json.dumps(tests_data, indent=2)}\n\n"
            "Return valid JSON following the system instruction."
        )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=EXPLANATION_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                ),
            )

            response_text = response.text or ""
            if not response_text.strip():
                raise AIParseError("Gemini returned an empty explanation response.")

        except AIConfigurationError:
            raise
        except Exception as exc:
            logger.error("Gemini explanation generation failed: %s", str(exc))
            raise AIServiceError(f"AI explanation service error: {type(exc).__name__}") from exc

        cleaned = _clean_json_str(response_text)
        try:
            parsed = json.loads(cleaned)
        except Exception as exc:
            logger.error("Failed to parse Gemini explanation JSON: %s", cleaned[:200])
            raise AIParseError("Malformed explanation response from AI provider.") from exc

        if not isinstance(parsed, dict):
            raise AIParseError("Expected a JSON object from AI provider.")

        test_explanations: list[TestExplanationItem] = []
        for item in parsed.get("test_explanations", []):
            if isinstance(item, dict):
                test_explanations.append(
                    TestExplanationItem(
                        test_name=str(item.get("test_name", "")),
                        observed_value=str(item.get("observed_value", "")),
                        unit=item.get("unit"),
                        reference_range=item.get("reference_range"),
                        status=item.get("status", "unspecified"),
                        explanation=str(item.get("explanation", "")),
                        interpretation=str(item.get("interpretation", "")),
                    )
                )

        return ReportExplanationResult(
            summary=str(parsed.get("summary", "Laboratory report summary generated.")),
            key_findings=[str(k) for k in parsed.get("key_findings", [])],
            test_explanations=test_explanations,
            limitations=parsed.get("limitations"),
            report_date=report_date or extraction.report_date_detected,
            data_points_analyzed=len(extraction.tests),
            disclaimer=STANDARD_MEDICAL_DISCLAIMER,
        )

    async def answer_report_question(
        self,
        extraction: ReportExtractionResult,
        request: ReportQuestionRequest,
        report_date: str | None = None,
    ) -> ReportQuestionResponse:
        self._ensure_configured()

        tests_data = [
            {
                "test_name": t.test_name,
                "value": t.value,
                "unit": t.unit,
                "reference_range": t.reference_range,
                "status": t.status,
            }
            for t in extraction.tests
        ]

        prompt = (
            f"Confirmed report date: {report_date or 'N/A'}\n"
            f"Confirmed lab tests in this report:\n{json.dumps(tests_data, indent=2)}\n\n"
            f"Patient question: {request.question}\n\n"
            "Answer the question following the safety rules and return valid JSON."
        )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=QUESTION_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                ),
            )

            response_text = response.text or ""
            if not response_text.strip():
                raise AIParseError("Gemini returned an empty question response.")

        except AIConfigurationError:
            raise
        except Exception as exc:
            logger.error("Gemini question answering failed: %s", str(exc))
            raise AIServiceError(f"AI question service error: {type(exc).__name__}") from exc

        cleaned = _clean_json_str(response_text)
        try:
            parsed = json.loads(cleaned)
        except Exception as exc:
            logger.error("Failed to parse Gemini Q&A JSON: %s", cleaned[:200])
            raise AIParseError("Malformed answer response from AI provider.") from exc

        if not isinstance(parsed, dict):
            raise AIParseError("Expected a JSON object from AI provider.")

        cited = [str(c) for c in parsed.get("cited_tests", [])]

        return ReportQuestionResponse(
            question=request.question,
            answer=str(parsed.get("answer", "")),
            cited_tests=cited,
            disclaimer=STANDARD_MEDICAL_DISCLAIMER,
        )
