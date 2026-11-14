"""Tests for Emergency Mode and Nearby Healthcare Search."""

import datetime
from unittest.mock import patch, AsyncMock
import httpx
import pytest
from httpx import AsyncClient

from app.schemas.hospitals import FacilityItem


async def create_user_and_profiles(client: AsyncClient, email: str):
    """Helper to register user and create two profiles."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Emergency Tester", "password": "Password123!"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profiles_res = await client.get("/api/v1/profiles", headers=headers)
    assert profiles_res.status_code == 200
    p1 = next(p for p in profiles_res.json() if p["is_default"])

    p2_res = await client.post(
        "/api/v1/profiles",
        headers=headers,
        json={
            "name": "Family Member",
            "relationship_type": "Child",
            "date_of_birth": "2015-06-01",
            "blood_type": "O+",
            "allergies": "Peanuts",
        },
    )
    assert p2_res.status_code == 201
    p2 = p2_res.json()

    return headers, p1["id"], p2["id"]


@pytest.mark.asyncio
async def test_emergency_auth_required(client: AsyncClient):
    """Unauthenticated calls must return 401."""
    res = await client.get("/api/v1/emergency")
    assert res.status_code == 401

    hospitals_res = await client.get("/api/v1/hospitals?lat=28.6139&lon=77.2090")
    assert hospitals_res.status_code == 401


@pytest.mark.asyncio
async def test_emergency_profile_isolation_and_null_fields(client: AsyncClient):
    """Verify emergency endpoint isolates profile data and respects null fields."""
    headers, p1_id, p2_id = await create_user_and_profiles(client, "emer-iso@example.com")

    # Update p1 with specific fields
    upd_res = await client.put(
        f"/api/v1/profiles/{p1_id}",
        headers=headers,
        json={
            "blood_type": "B+",
            "allergies": "Penicillin",
        },
    )
    assert upd_res.status_code == 200

    # Add emergency contact for p1
    c1_res = await client.post(
        "/api/v1/contacts",
        headers=headers,
        params={"profile_id": p1_id},
        json={
            "name": "Jane Doe",
            "contact_type": "emergency",
            "contact_relationship": "Spouse",
            "phone": "555-0101",
            "profile_id": p1_id,
        },
    )
    assert c1_res.status_code == 201

    # Add active medicine for p1
    m1_res = await client.post(
        "/api/v1/medicines",
        headers=headers,
        params={"profile_id": p1_id},
        json={
            "name": "Metformin",
            "dosage": "500mg",
            "frequency": "Daily",
            "is_active": True,
        },
    )
    assert m1_res.status_code == 201

    # Inactive medicine for p1 (should not appear in active medicines list)
    await client.post(
        "/api/v1/medicines",
        headers=headers,
        params={"profile_id": p1_id},
        json={
            "name": "Old Amoxicillin",
            "dosage": "250mg",
            "frequency": "Once",
            "is_active": False,
        },
    )

    # 1. Query emergency for p1
    p1_emer = await client.get("/api/v1/emergency", headers=headers, params={"profile_id": p1_id})
    assert p1_emer.status_code == 200
    p1_data = p1_emer.json()

    assert p1_data["profile"]["id"] == p1_id
    assert p1_data["profile"]["blood_type"] == "B+"
    assert p1_data["profile"]["allergies"] == "Penicillin"
    assert p1_data["profile"]["date_of_birth"] is None  # Unspecified remains null

    assert len(p1_data["emergency_contacts"]) == 1
    assert p1_data["emergency_contacts"][0]["name"] == "Jane Doe"
    assert p1_data["emergency_contacts"][0]["phone"] == "555-0101"

    assert len(p1_data["active_medicines"]) == 1
    assert p1_data["active_medicines"][0]["name"] == "Metformin"

    # 2. Query emergency for p2
    p2_emer = await client.get("/api/v1/emergency", headers=headers, params={"profile_id": p2_id})
    assert p2_emer.status_code == 200
    p2_data = p2_emer.json()

    assert p2_data["profile"]["id"] == p2_id
    assert p2_data["profile"]["blood_type"] == "O+"
    assert p2_data["profile"]["allergies"] == "Peanuts"
    assert p2_data["profile"]["date_of_birth"] == "2015-06-01"
    # p2 has no contacts or medicines
    assert len(p2_data["emergency_contacts"]) == 0
    assert len(p2_data["active_medicines"]) == 0


@pytest.mark.asyncio
async def test_emergency_rejects_cross_user_and_inactive_profiles(client: AsyncClient):
    """Backend must return 403 if profile belongs to another user or is inactive."""
    headers1, u1_p1, _ = await create_user_and_profiles(client, "user1-emer@example.com")
    headers2, u2_p1, _ = await create_user_and_profiles(client, "user2-emer@example.com")

    # Cross-user query: user2 tries to access user1's profile
    cross_res = await client.get("/api/v1/emergency", headers=headers2, params={"profile_id": u1_p1})
    assert cross_res.status_code == 403

    # Create secondary profile and deactivate it via is_active=False
    sec = await client.post(
        "/api/v1/profiles",
        headers=headers1,
        json={"name": "Temp Profile", "relationship_type": "Other"},
    )
    assert sec.status_code == 201
    sec_id = sec.json()["id"]

    deact = await client.put(f"/api/v1/profiles/{sec_id}", headers=headers1, json={"is_active": False})
    assert deact.status_code == 200
    assert deact.json()["is_active"] is False

    # Query deactivated profile
    inact_res = await client.get("/api/v1/emergency", headers=headers1, params={"profile_id": sec_id})
    assert inact_res.status_code == 403


@pytest.mark.asyncio
async def test_hospitals_input_validation(client: AsyncClient):
    """Test boundary conditions and validation for latitude, longitude, and radius."""
    headers, p1_id, _ = await create_user_and_profiles(client, "hosp-val@example.com")

    # Invalid latitude (> 90)
    res = await client.get("/api/v1/hospitals?lat=95&lon=77.2090", headers=headers)
    assert res.status_code == 422

    # Invalid latitude (< -90)
    res = await client.get("/api/v1/hospitals?lat=-95&lon=77.2090", headers=headers)
    assert res.status_code == 422

    # Invalid longitude (> 180)
    res = await client.get("/api/v1/hospitals?lat=28.6139&lon=185", headers=headers)
    assert res.status_code == 422

    # Invalid radius (< 500)
    res = await client.get("/api/v1/hospitals?lat=28.6139&lon=77.2090&radius=400", headers=headers)
    assert res.status_code == 422

    # Invalid radius (> 50000)
    res = await client.get("/api/v1/hospitals?lat=28.6139&lon=77.2090&radius=60000", headers=headers)
    assert res.status_code == 422

    # Invalid facility_type
    res = await client.get(
        "/api/v1/hospitals?lat=28.6139&lon=77.2090&facility_type=invalid_type",
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_hospitals_geoapify_success(client: AsyncClient):
    """Test successful Geoapify Places search with mocked facility result."""
    headers, _, _ = await create_user_and_profiles(client, "hosp-geo@example.com")

    mock_facility = FacilityItem(
        id="geo_123",
        name="City General Hospital",
        facility_type="hospital",
        address="123 Health Ave, Metro City",
        distance_meters=250.0,
        latitude=28.6150,
        longitude=77.2100,
        phone="+1-800-555-0199",
        source="Geoapify Places",
        attribution="Powered by Geoapify | © OpenStreetMap contributors",
    )

    with patch(
        "app.services.places_service.fetch_geoapify_facilities",
        AsyncMock(return_value=([mock_facility], True)),
    ):
        res = await client.get(
            "/api/v1/hospitals?lat=28.6139&lon=77.2090&radius=5000",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert len(data["facilities"]) == 1
        f = data["facilities"][0]
        assert f["name"] == "City General Hospital"
        assert f["facility_type"] == "hospital"
        assert f["phone"] == "+1-800-555-0199"
        assert f["source"] == "Geoapify Places"
        assert f["distance_meters"] == 250.0
        assert any("Geoapify" in attr for attr in data["source_attribution"])


@pytest.mark.asyncio
async def test_hospitals_overpass_blood_bank(client: AsyncClient):
    """Test blood bank query routed to OpenStreetMap Overpass with mocked response."""
    headers, _, _ = await create_user_and_profiles(client, "hosp-osm@example.com")

    mock_blood_bank = FacilityItem(
        id="osm_blood_bank_998877",
        name="Red Cross Blood Bank",
        facility_type="blood_bank",
        address="45 Blood Drive, Metro City",
        distance_meters=310.0,
        latitude=28.6145,
        longitude=77.2095,
        phone="+1-800-RED-CROSS",
        source="OpenStreetMap Overpass",
        attribution="Data © OpenStreetMap contributors under ODbL",
    )

    with patch(
        "app.services.places_service.fetch_overpass_blood_banks",
        AsyncMock(return_value=([mock_blood_bank], True)),
    ):
        res = await client.get(
            "/api/v1/hospitals?lat=28.6139&lon=77.2090&facility_type=blood_bank",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert len(data["facilities"]) == 1
        f = data["facilities"][0]
        assert f["name"] == "Red Cross Blood Bank"
        assert f["facility_type"] == "blood_bank"
        assert f["phone"] == "+1-800-RED-CROSS"
        assert f["source"] == "OpenStreetMap Overpass"
        assert any("OpenStreetMap" in attr for attr in data["source_attribution"])


@pytest.mark.asyncio
async def test_hospitals_all_providers_unavailable(client: AsyncClient):
    """When external providers fail or time out, return provider_unavailable without crashing (no 500)."""
    headers, _, _ = await create_user_and_profiles(client, "hosp-fail@example.com")

    with patch(
        "app.services.places_service.fetch_geoapify_facilities",
        AsyncMock(return_value=([], False)),
    ), patch(
        "app.services.places_service.fetch_overpass_fallback_facilities",
        AsyncMock(return_value=([], False)),
    ), patch(
        "app.services.places_service.fetch_overpass_blood_banks",
        AsyncMock(return_value=([], False)),
    ):
        res = await client.get(
            "/api/v1/hospitals?lat=28.6139&lon=77.2090",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "provider_unavailable"
        assert len(data["facilities"]) == 0
        assert "unreachable" in data["notes"].lower() or "unavailable" in data["notes"].lower()