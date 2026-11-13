"""Automated tests for report trends and chronological history comparison."""

import pytest
from httpx import AsyncClient

from app.schemas.report import LabTestItem, ReportExtractionResult
from tests.test_explanations import create_user_and_token


async def upload_and_confirm_report_with_tests(
    client: AsyncClient,
    token: str,
    tests: list[dict],
    date_str: str,
    filename: str = "report.pdf",
) -> str:
    """Helper to create and confirm a report with specific tests and date."""
    from unittest.mock import patch

    fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    files = {"file": (filename, fake_pdf, "application/pdf")}
    upload_res = await client.post(
        "/api/v1/reports",
        files=files,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert upload_res.status_code == 201
    report_id = upload_res.json()["id"]

    mock_tests = [
        LabTestItem(
            test_name=t["test_name"],
            value=t["value"],
            unit=t.get("unit"),
            reference_range=t.get("reference_range"),
            status=t.get("status", "normal"),
            needs_review=False,
        )
        for t in tests
    ]
    mock_extraction = ReportExtractionResult(
        patient_name_detected="Trend Patient",
        report_date_detected=date_str,
        lab_name_detected="City Lab",
        tests=mock_tests,
    )

    with patch("app.services.gemini_extractor.extract_report_data", return_value=mock_extraction):
        analyze_res = await client.post(
            f"/api/v1/reports/{report_id}/analyze",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert analyze_res.status_code == 200

    confirm_res = await client.post(
        f"/api/v1/reports/{report_id}/confirm",
        json={
            "tests": tests,
            "patient_name_detected": "Trend Patient",
            "report_date_detected": date_str,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert confirm_res.status_code == 200
    return report_id


@pytest.mark.asyncio
async def test_trends_across_confirmed_reports_compatible_units(client: AsyncClient):
    """Trend comparison computes diffs and directions for compatible units."""
    token, _ = await create_user_and_token(client, "trend_compat@example.com", "Trend User 1")

    # Report 1 (older)
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hemoglobin",
                "value": "12.0",
                "unit": "g/dL",
                "reference_range": "12.0 - 15.5",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-01-10",
        filename="cbc_jan.pdf",
    )

    # Report 2 (newer) - Hemoglobin rose to 13.5 g/dL
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hemoglobin",
                "value": "13.5",
                "unit": "g/dL",
                "reference_range": "12.0 - 15.5",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-03-10",
        filename="cbc_mar.pdf",
    )

    trends_res = await client.get(
        "/api/v1/reports/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trends_res.status_code == 200
    data = trends_res.json()

    assert data["total_confirmed_reports"] == 2
    assert data["tracked_tests_count"] == 1
    hb_summary = data["tests"][0]
    assert hb_summary["test_name"] == "Hemoglobin"
    assert len(hb_summary["data_points"]) == 2

    # Verify comparison
    comp = hb_summary["comparisons"][1]
    assert comp["is_comparable"] is True
    assert comp["direction"] == "higher"
    assert comp["difference"] == 1.5
    assert comp["percent_change"] == 12.5


@pytest.mark.asyncio
async def test_trends_safe_unit_conversion_g_dl_and_g_l(client: AsyncClient):
    """Trend comparison handles safe standard unit conversions (1 g/dL = 10 g/L)."""
    token, _ = await create_user_and_token(client, "trend_convert@example.com", "Trend User 2")

    # Report 1: 120 g/L
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hemoglobin",
                "value": "120",
                "unit": "g/L",
                "reference_range": "120 - 155",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-01-01",
        filename="rep1.pdf",
    )

    # Report 2: 13.0 g/dL (which is 130 g/L -> increase of 1.0 g/dL)
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hemoglobin",
                "value": "13.0",
                "unit": "g/dL",
                "reference_range": "12.0 - 15.5",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-02-01",
        filename="rep2.pdf",
    )

    trends_res = await client.get(
        "/api/v1/reports/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trends_res.status_code == 200
    data = trends_res.json()

    hb_summary = data["tests"][0]
    comp = hb_summary["comparisons"][1]
    assert comp["is_comparable"] is True
    assert comp["direction"] == "higher"
    # 13.0 - (120 / 10) = 1.0
    assert comp["difference"] == 1.0


@pytest.mark.asyncio
async def test_trends_incompatible_units_marked_not_comparable(client: AsyncClient):
    """When units are fundamentally incompatible (e.g. % vs mg/dL), marks 'not_comparable' with reason."""
    token, _ = await create_user_and_token(client, "trend_incompat@example.com", "Trend Incompat")

    # Report 1: Hematocrit in %
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hematocrit",
                "value": "42",
                "unit": "%",
                "reference_range": "37 - 48",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-01-01",
    )

    # Report 2: Incompatible unit mg/dL
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Hematocrit",
                "value": "140",
                "unit": "mg/dL",
                "reference_range": None,
                "status": "unspecified",
                "needs_review": False,
            }
        ],
        date_str="2026-02-01",
    )

    trends_res = await client.get(
        "/api/v1/reports/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trends_res.status_code == 200
    data = trends_res.json()

    summary = data["tests"][0]
    comp = summary["comparisons"][1]
    assert comp["is_comparable"] is False
    assert comp["direction"] == "not_comparable"
    assert "incompatible" in comp["non_comparable_reason"].lower()


@pytest.mark.asyncio
async def test_trends_non_numeric_and_missing_units_marked_not_comparable(client: AsyncClient):
    """Non-numeric values or missing units are refused safely."""
    token, _ = await create_user_and_token(client, "trend_qual@example.com", "Trend Qual")

    # Report 1: Qualitative / Missing unit
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Urine Protein",
                "value": "Negative",
                "unit": None,
                "reference_range": "Negative",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-01-01",
    )

    # Report 2: Trace
    await upload_and_confirm_report_with_tests(
        client,
        token,
        tests=[
            {
                "test_name": "Urine Protein",
                "value": "Trace",
                "unit": None,
                "reference_range": "Negative",
                "status": "unspecified",
                "needs_review": True,
            }
        ],
        date_str="2026-02-01",
    )

    trends_res = await client.get(
        "/api/v1/reports/trends",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert trends_res.status_code == 200
    data = trends_res.json()

    summary = data["tests"][0]
    comp = summary["comparisons"][1]
    assert comp["is_comparable"] is False
    assert comp["direction"] == "not_comparable"
    assert "non-numeric" in comp["non_comparable_reason"].lower()


@pytest.mark.asyncio
async def test_trends_user_isolation(client: AsyncClient):
    """User A cannot see User B's reports in their trends view."""
    token_a, _ = await create_user_and_token(client, "user_iso_a@example.com", "Iso User A")
    token_b, _ = await create_user_and_token(client, "user_iso_b@example.com", "Iso User B")

    # User B has confirmed report
    await upload_and_confirm_report_with_tests(
        client,
        token_b,
        tests=[
            {
                "test_name": "Glucose",
                "value": "95",
                "unit": "mg/dL",
                "reference_range": "70 - 99",
                "status": "normal",
                "needs_review": False,
            }
        ],
        date_str="2026-01-01",
    )

    # User A requests trends
    trends_a = await client.get(
        "/api/v1/reports/trends",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert trends_a.status_code == 200
    assert trends_a.json()["total_confirmed_reports"] == 0
    assert len(trends_a.json()["tests"]) == 0
