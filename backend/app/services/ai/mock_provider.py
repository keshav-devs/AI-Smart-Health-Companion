"""Mock AI explanation provider for automated tests and offline testing."""

from __future__ import annotations

from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
    TestExplanationItem,
)
from app.schemas.report import ReportExtractionResult, STANDARD_MEDICAL_DISCLAIMER
from app.services.ai.base import AIExplanationProvider


class MockAIProvider(AIExplanationProvider):
    """Deterministic mock provider that never calls external networks or requires an API key."""

    async def explain_report(
        self,
        extraction: ReportExtractionResult,
        report_date: str | None = None,
    ) -> ReportExplanationResult:
        tests = extraction.tests

        if not tests:
            return ReportExplanationResult(
                summary="The provided report contains no confirmed laboratory test values to explain.",
                key_findings=[],
                test_explanations=[],
                limitations="No test results were found in the confirmed data for this report.",
                report_date=report_date or extraction.report_date_detected,
                data_points_analyzed=0,
                disclaimer=STANDARD_MEDICAL_DISCLAIMER,
            )

        test_explanations: list[TestExplanationItem] = []
        key_findings: list[str] = []

        for item in tests:
            status_desc = {
                "normal": "within the laboratory reference range",
                "high": "higher than the laboratory reference range",
                "low": "lower than the laboratory reference range",
                "unspecified": "not compared to a standard numeric range",
            }.get(item.status, "evaluated as unspecified")

            explanation_text = f"{item.test_name} is a standard laboratory marker evaluated during routine blood testing."
            interpretation_text = (
                f"Recorded value of {item.value} {item.unit or ''} is {status_desc} "
                f"(printed range: {item.reference_range or 'not specified'})."
            )

            test_explanations.append(
                TestExplanationItem(
                    test_name=item.test_name,
                    observed_value=item.value,
                    unit=item.unit,
                    reference_range=item.reference_range,
                    status=item.status,
                    explanation=explanation_text,
                    interpretation=interpretation_text,
                )
            )

            if item.status in ("high", "low"):
                key_findings.append(f"{item.test_name} ({item.value} {item.unit or ''}) is {item.status}.")

        if not key_findings:
            summary = "All recorded laboratory tests are within the reference ranges specified by the testing facility."
        else:
            summary = (
                f"Report shows {len(tests)} confirmed test(s). "
                f"{len(key_findings)} test(s) fall outside the lab's printed reference ranges."
            )

        return ReportExplanationResult(
            summary=summary,
            key_findings=key_findings,
            test_explanations=test_explanations,
            limitations=(
                "Explanations are informational definitions only and do not constitute a diagnosis. "
                "Always review abnormal lab values directly with your physician."
            ),
            report_date=report_date or extraction.report_date_detected,
            data_points_analyzed=len(tests),
            disclaimer=STANDARD_MEDICAL_DISCLAIMER,
        )

    async def answer_report_question(
        self,
        extraction: ReportExtractionResult,
        request: ReportQuestionRequest,
        report_date: str | None = None,
    ) -> ReportQuestionResponse:
        tests = extraction.tests
        q_lower = request.question.lower()

        # Match relevant tests by question keywords
        matching_tests = [t for t in tests if t.test_name.lower() in q_lower]

        if matching_tests:
            cited = [t.test_name for t in matching_tests]
            details = "; ".join(
                f"{t.test_name} is recorded as {t.value} {t.unit or ''} (range: {t.reference_range or 'N/A'}, status: {t.status})"
                for t in matching_tests
            )
            answer = (
                f"Based strictly on this report: {details}. "
                "These values reflect your laboratory test results at the time of testing. "
                "Please consult your healthcare provider for clinical evaluation."
            )
        else:
            cited = [t.test_name for t in tests[:3]] if tests else []
            answer = (
                f"Regarding your question ('{request.question}'): "
                f"This report records {len(tests)} test(s). "
                "All explanations are strictly educational and informational based solely on the recorded values. "
                "Please speak with your doctor or clinical provider for any medical decisions."
            )

        return ReportQuestionResponse(
            question=request.question,
            answer=answer,
            cited_tests=cited,
            disclaimer=STANDARD_MEDICAL_DISCLAIMER,
        )
