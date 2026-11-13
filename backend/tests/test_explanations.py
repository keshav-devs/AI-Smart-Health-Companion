"""Automated tests for Milestone 4: Confirmed report explanations and Q&A."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionResponse,
    TestExplanationItem,
)
from app.schemas.report import STANDARD_MEDICAL_DISCLAIMER
from app.services.ai import (
    AIConfigurationError,
    AIParseError,
    AIServiceError,
    MockAIProvider,
    set_ai_provider,
)


async def create_user_and_token(client: AsyncClient, email: str, name: str) -> tuple[str, str]:
    """Helper to register and login a user."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": name},
    )
    assert reg.status_code == 201

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    user_id = login.json()["user"]["id"]
    return token, user_id


async def create_confirmed_report(client: AsyncClient, token: str) -> str:
    """Helper to upload, analyze (mock), and confirm a report."""
    fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    files = {"file": ("blood_report.pdf", fake_pdf, "application/pdf")}
    upload_res = await client.post(
        "/api/v1/reports",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload_res.status_code == 201
    report_id = upload_res.json()["id"]

    # Mock extract to put report into 'needs_review'
    from app.schemas.report import LabTestItem, ReportExtractionResult

    mock_extraction = ReportExtractionResult(
        patient_name_detected="Alice Smith",
        report_date_detected="2026-03-15",
        lab_name_detected="Metropolis Labs",
        tests=[
            LabTestItem(
                test_name="Hemoglobin",
                value="11.2",
                unit="g/dL",
                reference_range="12.0 - 15.5",
                status="low",
                needs_review=False,
            ),
            LabTestItem(
                test_name="Platelet Count",
                value="250",
                unit="10^3/uL",
                reference_range="150 - 450",
                status="normal",
                needs_review=False,
            ),
        ],
    )

    with patch("app.services.gemini_extractor.extract_report_data", return_value=mock_extraction):
        analyze_res = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert analyze_res.status_code == 200

    # Confirm the report to change status to 'analyzed'
    confirm_res = await client.post(
        f"/api/v1/reports/{report_id}/confirm",
        json={
            "tests": [
                {
                    "test_name": "Hemoglobin",
                    "value": "11.2",
                    "unit": "g/dL",
                    "reference_range": "12.0 - 15.5",
                    "status": "low",
                    "needs_review": False,
                },
                {
                    "test_name": "Platelet Count",
                    "value": "250",
                    "unit": "10^3/uL",
                    "reference_range": "150 - 450",
                    "status": "normal",
                    "needs_review": False,
                },
            ],
            "patient_name_detected": "Alice Smith",
            "report_date_detected": "2026-03-15",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "analyzed"

    return report_id


@pytest.mark.asyncio
async def test_explain_confirmed_report_success_with_mock_provider(client: AsyncClient):
    """Owner can request an explanation for a confirmed report using the mock provider."""
    token, _ = await create_user_and_token(client, "alice.exp@example.com", "Alice Exp")
    report_id = await create_confirmed_report(client, token)

    # Use MockAIProvider
    set_ai_provider(MockAIProvider())
    try:
        response = await client.post(
            f"/api/v1/reports/{report_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()

        assert "summary" in data
        assert len(data["test_explanations"]) == 2
        assert data["test_explanations"][0]["test_name"] == "Hemoglobin"
        assert "disclaimer" in data
        assert data["disclaimer"] == STANDARD_MEDICAL_DISCLAIMER

        # Check that GET /reports/{id}/explanation retrieves the stored explanation
        get_res = await client.get(
            f"/api/v1/reports/{report_id}/explanation",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_res.status_code == 200
        assert get_res.json()["summary"] == data["summary"]
    finally:
        set_ai_provider(None)


@pytest.mark.asyncio
async def test_explain_report_unconfirmed_fails(client: AsyncClient):
    """Cannot explain an unconfirmed report; must return 400."""
    token, _ = await create_user_and_token(client, "unconfirmed@example.com", "Unconfirmed Tester")
    fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    files = {"file": ("raw.pdf", fake_pdf, "application/pdf")}
    upload_res = await client.post(
        "/api/v1/reports",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    report_id = upload_res.json()["id"]

    response = await client.post(
        f"/api/v1/reports/{report_id}/explain",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "only confirmed lab reports can be explained" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_explain_report_ownership_isolation(client: AsyncClient):
    """User B cannot request explanation or questions for User A's report."""
    token_a, _ = await create_user_and_token(client, "user_a@example.com", "User A")
    token_b, _ = await create_user_and_token(client, "user_b@example.com", "User B")
    report_id = await create_confirmed_report(client, token_a)

    # User B tries to explain User A's report
    response = await client.post(
        f"/api/v1/reports/{report_id}/explain",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert response.status_code == 404

    # User B tries to ask questions about User A's report
    q_res = await client.post(
        f"/api/v1/reports/{report_id}/questions",
        json={"question": "What is my hemoglobin?"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert q_res.status_code == 404


@pytest.mark.asyncio
async def test_explain_report_missing_api_key_returns_503(client: AsyncClient):
    """When GEMINI_API_KEY is not configured, returns 503 configuration error without fake data."""
    token, _ = await create_user_and_token(client, "nokey@example.com", "No Key User")
    report_id = await create_confirmed_report(client, token)

    mock_gemini = AsyncMock()
    mock_gemini.explain_report.side_effect = AIConfigurationError(
        "AI explanation is not configured yet. GEMINI_API_KEY is not set."
    )
    set_ai_provider(mock_gemini)
    try:
        response = await client.post(
            f"/api/v1/reports/{report_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"].lower()
    finally:
        set_ai_provider(None)


@pytest.mark.asyncio
async def test_explain_report_provider_failure_returns_503(client: AsyncClient):
    """When AI provider network/service fails, returns 503 without fake data."""
    token, _ = await create_user_and_token(client, "failprov@example.com", "Fail Provider")
    report_id = await create_confirmed_report(client, token)

    mock_gemini = AsyncMock()
    mock_gemini.explain_report.side_effect = AIServiceError("AI explanation service error: 500")
    set_ai_provider(mock_gemini)
    try:
        response = await client.post(
            f"/api/v1/reports/{report_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 503
        assert "service error" in response.json()["detail"].lower()
    finally:
        set_ai_provider(None)


@pytest.mark.asyncio
async def test_explain_report_malformed_output_returns_502(client: AsyncClient):
    """When AI provider returns unparseable or malformed output, returns 502."""
    token, _ = await create_user_and_token(client, "malformed_ai@example.com", "Malformed User")
    report_id = await create_confirmed_report(client, token)

    mock_gemini = AsyncMock()
    mock_gemini.explain_report.side_effect = AIParseError("Malformed explanation response.")
    set_ai_provider(mock_gemini)
    try:
        response = await client.post(
            f"/api/v1/reports/{report_id}/explain",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 502
        assert "malformed explanation" in response.json()["detail"].lower()
    finally:
        set_ai_provider(None)


@pytest.mark.asyncio
async def test_ask_report_question_success_and_unconfirmed_guard(client: AsyncClient):
    """Question answering works for confirmed report and rejects unconfirmed report."""
    token, _ = await create_user_and_token(client, "question_user@example.com", "Q User")
    report_id = await create_confirmed_report(client, token)

    set_ai_provider(MockAIProvider())
    try:
        # Valid question on confirmed report
        res = await client.post(
            f"/api/v1/reports/{report_id}/questions",
            json={"question": "What is my hemoglobin level and reference range?"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["question"] == "What is my hemoglobin level and reference range?"
        assert "Hemoglobin" in data["cited_tests"]
        assert "disclaimer" in data

        # Too short question validation error (Pydantic min_length=3)
        bad_q = await client.post(
            f"/api/v1/reports/{report_id}/questions",
            json={"question": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert bad_q.status_code == 422
    finally:
        set_ai_provider(None)
