"""Regression checks for active-profile isolation on health records."""

import io
from httpx import AsyncClient

VALID_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"


async def create_user_and_profiles(client: AsyncClient, email: str):
    registration = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Profile Test", "password": "SecurePassword123!"},
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}
    profile_response = await client.get("/api/v1/profiles", headers=headers)
    assert profile_response.status_code == 200
    default_profile = next(p for p in profile_response.json() if p["is_default"])
    second_response = await client.post(
        "/api/v1/profiles",
        headers=headers,
        json={"name": "Family Member", "relationship_type": "Parent"},
    )
    assert second_response.status_code == 201
    return headers, default_profile["id"], second_response.json()["id"]


async def upload_report(client: AsyncClient, headers: dict[str, str], profile_id: str) -> str:
    response = await client.post(
        "/api/v1/reports",
        headers=headers,
        params={"profile_id": profile_id},
        files={"file": ("report.pdf", io.BytesIO(VALID_PDF), "application/pdf")},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def test_reports_are_not_accessible_from_another_profile(client: AsyncClient):
    headers, first_profile, second_profile = await create_user_and_profiles(client, "profile-reports@example.com")
    report_id = await upload_report(client, headers, first_profile)

    details = await client.get(f"/api/v1/reports/{report_id}", headers=headers, params={"profile_id": second_profile})
    file = await client.get(f"/api/v1/reports/{report_id}/file", headers=headers, params={"profile_id": second_profile})
    analyze = await client.post(f"/api/v1/reports/{report_id}/analyze", headers=headers, params={"profile_id": second_profile})

    assert details.status_code == 404
    assert file.status_code == 404
    assert analyze.status_code == 404
    assert (await client.get("/api/v1/reports", headers=headers, params={"profile_id": first_profile})).json()["total"] == 1
    assert (await client.get("/api/v1/reports", headers=headers, params={"profile_id": second_profile})).json()["total"] == 0


async def test_documents_are_scoped_for_view_download_and_delete(client: AsyncClient):
    headers, first_profile, second_profile = await create_user_and_profiles(client, "profile-documents@example.com")
    uploaded = await client.post(
        "/api/v1/documents",
        headers=headers,
        params={"profile_id": first_profile},
        data={"title": "Prescription", "document_type": "Prescription"},
        files={"file": ("prescription.pdf", io.BytesIO(VALID_PDF), "application/pdf")},
    )
    assert uploaded.status_code == 201
    document_id = uploaded.json()["id"]

    details = await client.get(f"/api/v1/documents/{document_id}", headers=headers, params={"profile_id": second_profile})
    download = await client.get(f"/api/v1/documents/{document_id}/download", headers=headers, params={"profile_id": second_profile})
    delete_wrong_profile = await client.delete(f"/api/v1/documents/{document_id}", headers=headers, params={"profile_id": second_profile})
    assert details.status_code == download.status_code == delete_wrong_profile.status_code == 404

    listed = await client.get("/api/v1/documents", headers=headers, params={"profile_id": first_profile})
    assert [doc["id"] for doc in listed.json()] == [document_id]
    delete_owned = await client.delete(f"/api/v1/documents/{document_id}", headers=headers, params={"profile_id": first_profile})
    assert delete_owned.status_code == 204


async def test_contacts_cannot_be_updated_or_deleted_from_another_profile(client: AsyncClient):
    headers, first_profile, second_profile = await create_user_and_profiles(client, "profile-contacts@example.com")
    created = await client.post(
        "/api/v1/contacts",
        headers=headers,
        params={"profile_id": first_profile},
        json={"profile_id": first_profile, "contact_type": "doctor", "name": "Dr. Example", "phone": "555-0100"},
    )
    assert created.status_code == 201
    contact_id = created.json()["id"]

    update_wrong_profile = await client.put(
        f"/api/v1/contacts/{contact_id}",
        headers=headers,
        params={"profile_id": second_profile},
        json={"name": "Changed"},
    )
    delete_wrong_profile = await client.delete(
        f"/api/v1/contacts/{contact_id}", headers=headers, params={"profile_id": second_profile}
    )
    assert update_wrong_profile.status_code == delete_wrong_profile.status_code == 404

    first_list = await client.get("/api/v1/contacts", headers=headers, params={"profile_id": first_profile})
    second_list = await client.get("/api/v1/contacts", headers=headers, params={"profile_id": second_profile})
    assert [contact["id"] for contact in first_list.json()] == [contact_id]
    assert second_list.json() == []


async def test_profile_creation_and_listing(client: AsyncClient):
    headers, default_profile, second_profile = await create_user_and_profiles(client, "profile-crud@example.com")

    # List active profiles — should have default and second profile
    res = await client.get("/api/v1/profiles", headers=headers)
    assert res.status_code == 200
    profiles = res.json()
    assert len(profiles) == 2

    # Create third profile
    third_res = await client.post(
        "/api/v1/profiles",
        headers=headers,
        json={"name": "Child Profile", "relationship_type": "Child"},
    )
    assert third_res.status_code == 201
    third_id = third_res.json()["id"]

    # Update profile name
    update_res = await client.put(
        f"/api/v1/profiles/{third_id}",
        headers=headers,
        json={"name": "First Child"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "First Child"

    # Deactivate third profile
    deactivate_res = await client.put(
        f"/api/v1/profiles/{third_id}",
        headers=headers,
        json={"is_active": False},
    )
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # List active only (default)
    active_res = await client.get("/api/v1/profiles?active_only=true", headers=headers)
    assert active_res.status_code == 200
    active_ids = [p["id"] for p in active_res.json()]
    assert third_id not in active_ids
    assert len(active_ids) == 2

    # List all profiles
    all_res = await client.get("/api/v1/profiles?active_only=false", headers=headers)
    assert all_res.status_code == 200
    assert len(all_res.json()) == 3

    # Attempt to deactivate default profile must fail
    fail_deactivate = await client.put(
        f"/api/v1/profiles/{default_profile}",
        headers=headers,
        json={"is_active": False},
    )
    assert fail_deactivate.status_code == 400


async def test_rejection_of_inactive_profile(client: AsyncClient):
    headers, default_profile, second_profile = await create_user_and_profiles(client, "profile-inactive@example.com")

    # Deactivate second profile
    deact = await client.put(
        f"/api/v1/profiles/{second_profile}",
        headers=headers,
        json={"is_active": False},
    )
    assert deact.status_code == 200

    # Accessing reports with inactive profile_id should be rejected with 403
    reports_res = await client.get("/api/v1/reports", headers=headers, params={"profile_id": second_profile})
    assert reports_res.status_code == 403
    assert reports_res.json()["detail"] == "Profile access denied."

    # Accessing medicines with inactive profile_id should be rejected with 403
    meds_res = await client.get("/api/v1/medicines", headers=headers, params={"profile_id": second_profile})
    assert meds_res.status_code == 403
    assert meds_res.json()["detail"] == "Profile access denied."

    # Creating journal entry with inactive profile_id should be rejected with 403
    journal_res = await client.post(
        "/api/v1/journal",
        headers=headers,
        json={"profile_id": second_profile, "date": "2026-11-13", "mood": "good"},
    )
    assert journal_res.status_code == 403
    assert journal_res.json()["detail"] == "Profile access denied."

    # Creating doctor question with inactive profile_id should be rejected with 403
    dq_res = await client.post(
        "/api/v1/doctor-questions",
        headers=headers,
        json={"profile_id": second_profile, "question": "Any concerns?"},
    )
    assert dq_res.status_code == 403
    assert dq_res.json()["detail"] == "Profile access denied."


async def test_rejection_of_cross_user_profile(client: AsyncClient):
    headers_a, user_a_default, _ = await create_user_and_profiles(client, "user-a@example.com")
    headers_b, user_b_default, _ = await create_user_and_profiles(client, "user-b@example.com")

    # User B tries to query reports with User A's profile_id
    cross_reports = await client.get("/api/v1/reports", headers=headers_b, params={"profile_id": user_a_default})
    assert cross_reports.status_code == 403
    assert cross_reports.json()["detail"] == "Profile access denied."

    # User B tries to query medicines with User A's profile_id
    cross_meds = await client.get("/api/v1/medicines", headers=headers_b, params={"profile_id": user_a_default})
    assert cross_meds.status_code == 403
    assert cross_meds.json()["detail"] == "Profile access denied."

    # User B tries to post journal with User A's profile_id
    cross_journal = await client.post(
        "/api/v1/journal",
        headers=headers_b,
        json={"profile_id": user_a_default, "date": "2026-11-13"},
    )
    assert cross_journal.status_code == 403
    assert cross_journal.json()["detail"] == "Profile access denied."

    # User B tries to post doctor question with User A's profile_id
    cross_dq = await client.post(
        "/api/v1/doctor-questions",
        headers=headers_b,
        json={"profile_id": user_a_default, "question": "Question for A?"},
    )
    assert cross_dq.status_code == 403
    assert cross_dq.json()["detail"] == "Profile access denied."

    # User B tries to update User A's profile
    cross_update = await client.put(
        f"/api/v1/profiles/{user_a_default}",
        headers=headers_b,
        json={"name": "Hacked Name"},
    )
    assert cross_update.status_code == 404


async def test_switching_profile_selection_and_isolation(client: AsyncClient):
    headers, default_profile, second_profile = await create_user_and_profiles(client, "profile-switch@example.com")

    # Query without profile_id should automatically resolve to default profile
    default_reports = await client.get("/api/v1/reports", headers=headers)
    assert default_reports.status_code == 200
    assert default_reports.json()["total"] == 0

    # Upload report specifically to second profile
    report_id = await upload_report(client, headers, second_profile)

    # When switching to second profile, the report is present
    second_reports = await client.get("/api/v1/reports", headers=headers, params={"profile_id": second_profile})
    assert second_reports.status_code == 200
    assert second_reports.json()["total"] == 1
    assert second_reports.json()["reports"][0]["id"] == report_id

    # The default profile still has 0 reports
    default_reports_check = await client.get("/api/v1/reports", headers=headers, params={"profile_id": default_profile})
    assert default_reports_check.status_code == 200
    assert default_reports_check.json()["total"] == 0
