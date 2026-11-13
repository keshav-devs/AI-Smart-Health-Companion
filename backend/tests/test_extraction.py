"""Automated tests for Milestone 3: Safe AI extraction from blood reports."""

import io
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from app.schemas.report import (
    LabTestItem,
    ReportExtractionResult,
    STANDARD_MEDICAL_DISCLAIMER,
)
from app.services.gemini_extractor import (
    GeminiConfigurationError,
    GeminiExtractionError,
    GeminiServiceError,
    interpret_range_comparison,
)

VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


async def create_user_and_upload_report(
    client: AsyncClient, email: str, name: str
) -> tuple[str, str]:
    """Helper: registers user, uploads a valid PDF report, returns (token, report_id)."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": name, "password": "SecurePassword123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    upload = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("lab_report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"report_type": "Complete Blood Count"},
    )
    assert upload.status_code == 201
    report_id = upload.json()["id"]
    return token, report_id


# ── Range Interpretation Unit Tests ────────────────────────────────────

def test_interpret_range_normal():
    """Values clearly within printed range are marked normal."""
    status, needs_review, _ = interpret_range_comparison("14.0", "12.0 - 16.0")
    assert status == "normal"
    assert needs_review is False


def test_interpret_range_high():
    """Values above printed upper limit are marked high."""
    status, needs_review, _ = interpret_range_comparison("18.5", "12.0 - 16.0")
    assert status == "high"
    assert needs_review is False


def test_interpret_range_low():
    """Values below printed lower limit are marked low."""
    status, needs_review, _ = interpret_range_comparison("10.2", "12.0 - 16.0")
    assert status == "low"
    assert needs_review is False


def test_interpret_range_upper_bound_only():
    """Ranges formatted as '< X' are interpreted accurately."""
    status, needs_review, _ = interpret_range_comparison("95", "< 100")
    assert status == "normal"
    assert needs_review is False

    status_high, _, _ = interpret_range_comparison("130", "< 100")
    assert status_high == "high"


def test_interpret_range_missing_or_qualitative():
    """Missing or unparseable ranges flag needs_review=True and status=unspecified."""
    status, needs_review, reason = interpret_range_comparison("Positive", None)
    assert status == "unspecified"
    assert needs_review is True
    assert "No printed reference range" in reason

    status2, needs_review2, reason2 = interpret_range_comparison("15", "Varies by lab protocol")
    assert status2 == "unspecified"
    assert needs_review2 is True


# ── AI Extraction Integration Tests (Mocked AI Provider) ──────────────

@pytest.mark.asyncio
async def test_analyze_report_success(client: AsyncClient):
    """Successful extraction updates status to 'needs_review' and stores structured tests."""
    token, report_id = await create_user_and_upload_report(
        client, "extract_success@example.com", "Patient Success"
    )

    mock_result = ReportExtractionResult(
        patient_name_detected="Patient Success",
        report_date_detected="2026-10-01",
        lab_name_detected="Metropolis Diagnostics",
        tests=[
            LabTestItem(
                test_name="Hemoglobin",
                value="14.2",
                unit="g/dL",
                reference_range="12.0 - 15.5",
                status="normal",
                needs_review=False,
            ),
            LabTestItem(
                test_name="Fasting Blood Glucose",
                value="118",
                unit="mg/dL",
                reference_range="70 - 99",
                status="high",
                needs_review=False,
            ),
        ],
        disclaimer=STANDARD_MEDICAL_DISCLAIMER,
    )

    with patch(
        "app.services.gemini_extractor.extract_report_data",
        new=AsyncMock(return_value=mock_result),
    ):
        response = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "needs_review"
    assert data["extracted_data"] is not None
    assert len(data["extracted_data"]["tests"]) == 2
    assert data["extracted_data"]["tests"][0]["test_name"] == "Hemoglobin"
    assert data["extracted_data"]["tests"][0]["status"] == "normal"
    assert data["extracted_data"]["tests"][1]["test_name"] == "Fasting Blood Glucose"
    assert data["extracted_data"]["tests"][1]["status"] == "high"
    assert STANDARD_MEDICAL_DISCLAIMER in data["extracted_data"]["disclaimer"]


@pytest.mark.asyncio
async def test_analyze_report_missing_api_key(client: AsyncClient):
    """When GEMINI_API_KEY is missing, endpoint returns 503 and marks status='failed'."""
    token, report_id = await create_user_and_upload_report(
        client, "missing_key@example.com", "Key Tester"
    )

    with patch(
        "app.services.gemini_extractor.extract_report_data",
        side_effect=GeminiConfigurationError("Gemini API key is not configured."),
    ):
        response = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 503
    assert "api key is not configured" in response.json()["detail"].lower()

    # Verify report status in database is updated to 'failed'
    get_res = await client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "failed"
    assert "api key is not configured" in get_res.json()["extraction_error"].lower()


@pytest.mark.asyncio
async def test_analyze_report_provider_failure(client: AsyncClient):
    """Provider failure returns 503 and sets status='failed' without fake values."""
    token, report_id = await create_user_and_upload_report(
        client, "provider_fail@example.com", "Provider Tester"
    )

    with patch(
        "app.services.gemini_extractor.extract_report_data",
        side_effect=GeminiServiceError("AI extraction service failed: ConnectionError."),
    ):
        response = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 503
    assert "ai extraction service failed" in response.json()["detail"].lower()

    get_res = await client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.json()["status"] == "failed"
    assert get_res.json()["extracted_data"] is None


@pytest.mark.asyncio
async def test_analyze_report_malformed_ai_output(client: AsyncClient):
    """Malformed output from AI returns 502 and sets status='failed'."""
    token, report_id = await create_user_and_upload_report(
        client, "malformed@example.com", "Malformed Tester"
    )

    with patch(
        "app.services.gemini_extractor.extract_report_data",
        side_effect=GeminiExtractionError("Malformed extraction response from AI provider."),
    ):
        response = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 502
    assert "malformed extraction response" in response.json()["detail"].lower()

    get_res = await client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_analyze_report_ownership_isolation(client: AsyncClient):
    """User B cannot analyze or confirm User A's report."""
    token_a, report_id_a = await create_user_and_upload_report(
        client, "owner_a@example.com", "Owner A"
    )

    # Register User B
    reg_b = await client.post(
        "/api/v1/auth/register",
        json={"email": "attacker_b@example.com", "full_name": "Attacker B", "password": "SecurePassword123!"},
    )
    token_b = reg_b.json()["access_token"]

    # User B attempts to analyze User A's report
    res_analyze = await client.post(
        f"/api/v1/reports/{report_id_a}/analyze",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_analyze.status_code == 404

    # User B attempts to confirm User A's report
    res_confirm = await client.post(
        f"/api/v1/reports/{report_id_a}/confirm",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"tests": []},
    )
    assert res_confirm.status_code == 404


@pytest.mark.asyncio
async def test_confirm_extraction_flow(client: AsyncClient):
    """User can review, edit fields, and explicitly confirm extracted data."""
    token, report_id = await create_user_and_upload_report(
        client, "confirm_flow@example.com", "Confirm Tester"
    )

    # 1. First analyze report
    mock_result = ReportExtractionResult(
        patient_name_detected="Confirm Tester",
        tests=[
            LabTestItem(
                test_name="Platelets",
                value="220",
                unit="10^3/uL",
                reference_range="150 - 450",
                status="normal",
                needs_review=False,
            )
        ],
        disclaimer=STANDARD_MEDICAL_DISCLAIMER,
    )

    with patch(
        "app.services.gemini_extractor.extract_report_data",
        new=AsyncMock(return_value=mock_result),
    ):
        await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )

    # 2. User confirms with user-corrected values
    confirm_payload = {
        "tests": [
            {
                "test_name": "Platelet Count (Corrected)",
                "value": "225",
                "unit": "10^3/uL",
                "reference_range": "150 - 450",
                "status": "normal",
                "needs_review": False,
            }
        ],
        "notes": "Verified by patient with physical lab sheet",
    }

    confirm_res = await client.post(
        f"/api/v1/reports/{report_id}/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json=confirm_payload,
    )
    assert confirm_res.status_code == 200
    confirmed_data = confirm_res.json()
    assert confirmed_data["status"] == "analyzed"
    assert confirmed_data["reviewed_at"] is not None
    assert confirmed_data["extracted_data"]["tests"][0]["test_name"] == "Platelet Count (Corrected)"
    assert confirmed_data["extracted_data"]["tests"][0]["value"] == "225"
    assert confirmed_data["extracted_data"]["summary_notes"] == "Verified by patient with physical lab sheet"


@pytest.mark.asyncio
async def test_confirm_unanalyzed_report_succeeds_as_manual_entry(client: AsyncClient):
    """Confirming a report without prior extraction acts as a manual entry and succeeds."""
    token, report_id = await create_user_and_upload_report(
        client, "unanalyzed_confirm@example.com", "Unanalyzed User"
    )

    response = await client.post(
        f"/api/v1/reports/{report_id}/confirm",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "tests": [
                {
                    "test_name": "Hemoglobin",
                    "value": "13.5",
                    "unit": "g/dL",
                    "reference_range": "12.0 - 15.5",
                    "status": "unspecified",  # Backend should compute 'normal'
                }
            ],
            "notes": "Entered manually"
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "manually_entered"
    assert data["extracted_data"]["provenance"] == "manual"
    assert data["extracted_data"]["tests"][0]["status"] == "normal"
    assert data["extracted_data"]["summary_notes"] == "Entered manually"
