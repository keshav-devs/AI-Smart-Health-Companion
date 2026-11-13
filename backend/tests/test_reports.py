"""Automated tests for report upload, listing, retrieval, and access control."""

import io
import uuid
import pytest
from httpx import AsyncClient


async def create_user_and_get_token(client: AsyncClient, email: str, name: str) -> str:
    """Helper to register a user and obtain an access token."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": name,
            "password": "SecurePassword123!",
        },
    )
    assert response.status_code == 201
    return response.json()["access_token"]


# Valid dummy file contents
VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\xff\xd9"


# ── Upload Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_valid_pdf_report(client: AsyncClient):
    """Uploading a valid PDF file succeeds with 201 and not_analyzed status."""
    token = await create_user_and_get_token(client, "patient1@example.com", "Patient One")
    files = {"file": ("blood_test.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    data = {"report_type": "Complete Blood Count (CBC)"}

    response = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        data=data,
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["filename"] == "blood_test.pdf"
    assert payload["report_type"] == "Complete Blood Count (CBC)"
    assert payload["mime_type"] == "application/pdf"
    assert payload["status"] == "not_analyzed"
    assert payload["file_size"] == len(VALID_PDF_BYTES)
    assert "id" in payload


@pytest.mark.asyncio
async def test_upload_valid_png_and_jpg_reports(client: AsyncClient):
    """Uploading valid PNG and JPG images succeeds."""
    token = await create_user_and_get_token(client, "patient2@example.com", "Patient Two")

    # PNG
    res_png = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("lab_result.png", io.BytesIO(VALID_PNG_BYTES), "image/png")},
    )
    assert res_png.status_code == 201
    assert res_png.json()["mime_type"] == "image/png"
    assert res_png.json()["status"] == "not_analyzed"

    # JPG
    res_jpg = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("scan.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")},
    )
    assert res_jpg.status_code == 201
    assert res_jpg.json()["mime_type"] == "image/jpeg"
    assert res_jpg.json()["status"] == "not_analyzed"


@pytest.mark.asyncio
async def test_upload_invalid_extension(client: AsyncClient):
    """Disallowed extension (e.g. .txt, .exe) returns 400 Bad Request."""
    token = await create_user_and_get_token(client, "patient3@example.com", "Patient Three")
    files = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00\x03\x00"), "application/x-msdownload")}

    response = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert response.status_code == 400
    assert "invalid file format" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_spoofed_mismatched_magic_bytes(client: AsyncClient):
    """File named .pdf but containing plain text fails magic header validation."""
    token = await create_user_and_get_token(client, "patient4@example.com", "Patient Four")
    files = {"file": ("fake_report.pdf", io.BytesIO(b"This is just plain text, not a PDF!"), "application/pdf")}

    response = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert response.status_code == 400
    assert "header does not match" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_empty_file(client: AsyncClient):
    """Uploading an empty 0-byte file returns 400."""
    token = await create_user_and_get_token(client, "patient5@example.com", "Patient Five")
    files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}

    response = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_oversized_file(client: AsyncClient):
    """Uploading a file exceeding max size (10 MB) returns 413."""
    token = await create_user_and_get_token(client, "patient6@example.com", "Patient Six")
    # 10 MB + 1 byte
    oversized = b"%PDF" + b"0" * (10 * 1024 * 1024)
    files = {"file": ("huge.pdf", io.BytesIO(oversized), "application/pdf")}

    response = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert response.status_code == 413
    assert "maximum allowed size" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_unauthenticated(client: AsyncClient):
    """Uploading without authentication returns 401."""
    files = {"file": ("report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")}
    response = await client.post("/api/v1/reports", files=files)
    assert response.status_code == 401


# ── Listing & Detail Tests ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_reports_isolated_per_user(client: AsyncClient):
    """Listing reports returns only the signed-in user's reports."""
    token_a = await create_user_and_get_token(client, "alice@example.com", "Alice")
    token_b = await create_user_and_get_token(client, "bob@example.com", "Bob")

    # Alice uploads 2 reports
    await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("alice_cbc.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"report_type": "CBC"},
    )
    await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("alice_lipid.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"report_type": "Lipid Panel"},
    )

    # Bob uploads 1 report
    await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_b}"},
        files={"file": ("bob_metabolic.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
        data={"report_type": "Metabolic"},
    )

    # Alice lists
    res_a = await client.get("/api/v1/reports", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["total"] == 2
    assert all(r["filename"].startswith("alice_") for r in data_a["reports"])

    # Bob lists
    res_b = await client.get("/api/v1/reports", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["total"] == 1
    assert data_b["reports"][0]["filename"] == "bob_metabolic.pdf"


@pytest.mark.asyncio
async def test_get_report_details_and_prevent_cross_user_access(client: AsyncClient):
    """A user cannot view another user's report details by changing the ID."""
    token_a = await create_user_and_get_token(client, "alice_detail@example.com", "Alice Detail")
    token_b = await create_user_and_get_token(client, "bob_detail@example.com", "Bob Detail")

    # Alice uploads
    up_res = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("private_alice.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
    )
    alice_report_id = up_res.json()["id"]

    # Alice can get her report
    alice_view = await client.get(
        f"/api/v1/reports/{alice_report_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert alice_view.status_code == 200
    assert alice_view.json()["filename"] == "private_alice.pdf"
    assert alice_view.json()["status"] == "not_analyzed"

    # Bob attempts to get Alice's report -> 404 (ownership check)
    bob_view = await client.get(
        f"/api/v1/reports/{alice_report_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert bob_view.status_code == 404

    # Non-existent UUID -> 404
    non_existent = str(uuid.uuid4())
    fake_view = await client.get(
        f"/api/v1/reports/{non_existent}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert fake_view.status_code == 404


@pytest.mark.asyncio
async def test_download_report_and_ownership_enforcement(client: AsyncClient):
    """Owner can download original report file; other users are rejected."""
    token_a = await create_user_and_get_token(client, "alice_dl@example.com", "Alice DL")
    token_b = await create_user_and_get_token(client, "bob_dl@example.com", "Bob DL")

    # Alice uploads
    up_res = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("download_test.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
    )
    report_id = up_res.json()["id"]

    # Alice downloads -> 200 with matching bytes
    dl_res = await client.get(
        f"/api/v1/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert dl_res.status_code == 200
    assert dl_res.content == VALID_PDF_BYTES

    # Bob tries to download Alice's report -> 404
    bob_dl = await client.get(
        f"/api/v1/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert bob_dl.status_code == 404

    # Unauthenticated download -> 401
    unauth_dl = await client.get(f"/api/v1/reports/{report_id}/download")
    assert unauth_dl.status_code == 401


@pytest.mark.asyncio
async def test_file_access_preview_and_download_disposition(client: AsyncClient):
    """Owner can access report file with inline disposition for preview or attachment for download."""
    token = await create_user_and_get_token(client, "preview_user@example.com", "Preview User")

    # Upload PDF
    up_res = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("preview_report.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
    )
    report_id = up_res.json()["id"]

    # 1. Preview (disposition=inline)
    preview_res = await client.get(
        f"/api/v1/reports/{report_id}/file?disposition=inline",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert preview_res.status_code == 200
    assert preview_res.content == VALID_PDF_BYTES
    assert "inline" in preview_res.headers.get("content-disposition", "")
    assert preview_res.headers["content-type"] == "application/pdf"

    # 2. Download (disposition=attachment)
    download_res = await client.get(
        f"/api/v1/reports/{report_id}/file?disposition=attachment",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert download_res.status_code == 200
    assert download_res.content == VALID_PDF_BYTES
    assert "attachment" in download_res.headers.get("content-disposition", "")

    # 3. Direct browser query token auth
    query_token_res = await client.get(
        f"/api/v1/reports/{report_id}/file?token={token}&disposition=inline",
    )
    assert query_token_res.status_code == 200
    assert query_token_res.content == VALID_PDF_BYTES


@pytest.mark.asyncio
async def test_file_access_ownership_denial_and_unauthenticated(client: AsyncClient):
    """Accessing /file without authentication returns 401; accessing by another user returns 404."""
    token_alice = await create_user_and_get_token(client, "alice_file@example.com", "Alice File")
    token_bob = await create_user_and_get_token(client, "bob_file@example.com", "Bob File")

    # Alice uploads
    up = await client.post(
        "/api/v1/reports",
        headers={"Authorization": f"Bearer {token_alice}"},
        files={"file": ("alice_secret.pdf", io.BytesIO(VALID_PDF_BYTES), "application/pdf")},
    )
    report_id = up.json()["id"]

    # 1. Unauthenticated -> 401
    unauth = await client.get(f"/api/v1/reports/{report_id}/file")
    assert unauth.status_code == 401

    # 2. Bob attempts to access Alice's file via header -> 404
    bob_attempt = await client.get(
        f"/api/v1/reports/{report_id}/file",
        headers={"Authorization": f"Bearer {token_bob}"},
    )
    assert bob_attempt.status_code == 404

    # 3. Bob attempts to access Alice's file via query param token -> 404
    bob_query_attempt = await client.get(
        f"/api/v1/reports/{report_id}/file?token={token_bob}",
    )
    assert bob_query_attempt.status_code == 404

