import pytest
from httpx import AsyncClient
from tests.test_explanations import create_user_and_token

@pytest.mark.asyncio
async def test_create_journal_entry(client: AsyncClient):
    token, user_id = await create_user_and_token(client, "journal1@example.com", "Journal User")
    
    # Get profile ID (default profile is auto-created)
    profiles_res = await client.get("/api/v1/profiles", headers={"Authorization": f"Bearer {token}"})
    assert profiles_res.status_code == 200
    profile_id = profiles_res.json()[0]["id"]
    
    payload = {
        "date": "2026-01-02",
        "mood": "Okay",
        "sleep_hours": 7.5,
        "symptoms": ["Nausea"],
        "notes": "Testing",
        "profile_id": profile_id
    }
    response = await client.post(
        "/api/v1/journal",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 201
    
    data = response.json()
    assert data["mood"] == "Okay"
    assert data["sleep_hours"] == 7.5
    assert "id" in data

@pytest.mark.asyncio
async def test_list_journal_entries(client: AsyncClient):
    token, user_id = await create_user_and_token(client, "journal2@example.com", "Journal User 2")
    profiles_res = await client.get("/api/v1/profiles", headers={"Authorization": f"Bearer {token}"})
    profile_id = profiles_res.json()[0]["id"]

    await client.post(
        "/api/v1/journal",
        json={"date": "2026-01-01", "mood": "Good", "profile_id": profile_id},
        headers={"Authorization": f"Bearer {token}"}
    )

    response = await client.get(
        f"/api/v1/journal?profile_id={profile_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["mood"] == "Good"

@pytest.mark.asyncio
async def test_update_journal_entry(client: AsyncClient):
    token, user_id = await create_user_and_token(client, "journal3@example.com", "Journal User 3")
    profiles_res = await client.get("/api/v1/profiles", headers={"Authorization": f"Bearer {token}"})
    profile_id = profiles_res.json()[0]["id"]

    create_res = await client.post(
        "/api/v1/journal",
        json={"date": "2026-01-01", "mood": "Good", "profile_id": profile_id},
        headers={"Authorization": f"Bearer {token}"}
    )
    entry_id = create_res.json()["id"]

    payload = {
        "mood": "Excellent",
        "sleep_hours": 9.0
    }
    response = await client.put(
        f"/api/v1/journal/{entry_id}",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mood"] == "Excellent"
    assert data["sleep_hours"] == 9.0

@pytest.mark.asyncio
async def test_delete_journal_entry(client: AsyncClient):
    token, user_id = await create_user_and_token(client, "journal4@example.com", "Journal User 4")
    profiles_res = await client.get("/api/v1/profiles", headers={"Authorization": f"Bearer {token}"})
    profile_id = profiles_res.json()[0]["id"]

    create_res = await client.post(
        "/api/v1/journal",
        json={"date": "2026-01-01", "mood": "Good", "profile_id": profile_id},
        headers={"Authorization": f"Bearer {token}"}
    )
    entry_id = create_res.json()["id"]

    response = await client.delete(
        f"/api/v1/journal/{entry_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 204
    
    get_res = await client.get(f"/api/v1/journal?profile_id={profile_id}", headers={"Authorization": f"Bearer {token}"})
    assert len(get_res.json()) == 0

@pytest.mark.asyncio
async def test_invalid_sleep_hours(client: AsyncClient):
    token, user_id = await create_user_and_token(client, "journal5@example.com", "Journal User 5")
    profiles_res = await client.get("/api/v1/profiles", headers={"Authorization": f"Bearer {token}"})
    profile_id = profiles_res.json()[0]["id"]

    payload = {
        "date": "2026-01-03",
        "sleep_hours": 25.0,  # Invalid: > 24
        "profile_id": profile_id
    }
    response = await client.post(
        "/api/v1/journal",
        json=payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 422
