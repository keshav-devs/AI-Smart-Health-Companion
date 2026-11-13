"""Automated tests for Milestone 5: Medicine management, dose tracking, and reminders."""

from datetime import date, datetime, timedelta, timezone
import pytest
from httpx import AsyncClient

from tests.test_explanations import create_user_and_token


@pytest.mark.asyncio
async def test_create_and_list_medicines(client: AsyncClient):
    """User can create and list their medicines with schedule configuration."""
    token, user_id = await create_user_and_token(client, "med_user1@example.com", "Med User 1")

    # Create medicine with initial schedule
    create_res = await client.post(
        "/api/v1/medicines",
        json={
            "name": "Metformin",
            "strength": "500 mg",
            "form": "Tablet",
            "instructions": "Take with breakfast and dinner",
            "start_date": "2026-01-01",
            "current_quantity": 60,
            "refill_threshold": 10,
            "schedule": {
                "frequency": "twice_daily",
                "times_per_day": 2,
                "specific_times": ["08:00", "20:00"],
                "timezone": "UTC",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    med_data = create_res.json()
    assert med_data["name"] == "Metformin"
    assert med_data["current_quantity"] == 60
    assert len(med_data["schedules"]) == 1
    assert med_data["schedules"][0]["specific_times"] == ["08:00", "20:00"]
    med_id = med_data["id"]

    # List medicines
    list_res = await client.get(
        "/api/v1/medicines",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1
    assert list_res.json()["medicines"][0]["id"] == med_id


@pytest.mark.asyncio
async def test_medicine_ownership_isolation(client: AsyncClient):
    """User B cannot access or modify User A's medicine."""
    token_a, _ = await create_user_and_token(client, "med_a@example.com", "User A")
    token_b, _ = await create_user_and_token(client, "med_b@example.com", "User B")

    create_res = await client.post(
        "/api/v1/medicines",
        json={"name": "Lisinopril", "strength": "10 mg"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_res.status_code == 201
    med_id = create_res.json()["id"]

    # User B tries to get User A's medicine
    get_res = await client.get(
        f"/api/v1/medicines/{med_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_res.status_code == 404

    # User B tries to update User A's medicine
    put_res = await client.put(
        f"/api/v1/medicines/{med_id}",
        json={"name": "Hacked Medicine"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert put_res.status_code == 404

    # User B tries to delete User A's medicine
    del_res = await client.delete(
        f"/api/v1/medicines/{med_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_res.status_code == 404

    # User B tries to log dose for User A's medicine
    dose_res = await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={
            "scheduled_time": datetime.now(timezone.utc).isoformat(),
            "status": "taken",
        },
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert dose_res.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_dose_logging_prevention(client: AsyncClient):
    """Accidental duplicate logs for the same scheduled dose are prevented (409 Conflict)."""
    token, _ = await create_user_and_token(client, "dedup_med@example.com", "Dedup User")

    create_res = await client.post(
        "/api/v1/medicines",
        json={"name": "Atorvastatin", "strength": "20 mg", "current_quantity": 30},
        headers={"Authorization": f"Bearer {token}"},
    )
    med_id = create_res.json()["id"]

    sched_time = datetime(2026, 4, 1, 8, 0, tzinfo=timezone.utc).isoformat()

    # First log -> success
    log1 = await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={"scheduled_time": sched_time, "status": "taken"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert log1.status_code == 201
    assert log1.json()["status"] == "taken"

    # Verify inventory was decremented from 30 to 29
    get_med = await client.get(
        f"/api/v1/medicines/{med_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_med.json()["current_quantity"] == 29

    # Second log with identical scheduled_time -> 409 Conflict
    log2 = await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={"scheduled_time": sched_time, "status": "taken"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert log2.status_code == 409
    assert "already exists" in log2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_today_doses_never_marked_missed_before_scheduled_time(client: AsyncClient):
    """Do not mark a dose 'missed' before its scheduled time has passed."""
    token, _ = await create_user_and_token(client, "today_dose@example.com", "Today User")

    # Future time today (e.g. 23:59)
    res = await client.post(
        "/api/v1/medicines",
        json={
            "name": "Night Sleep Aid",
            "schedule": {
                "frequency": "daily",
                "times_per_day": 1,
                "specific_times": ["23:59"],
                "timezone": "UTC",
            },
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201

    # Query today's doses
    today_res = await client.get(
        "/api/v1/medicines/doses/today?timezone=UTC",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert today_res.status_code == 200
    doses = today_res.json()["doses"]
    assert len(doses) == 1
    # Because 23:59 UTC has not passed, it MUST be 'pending' or 'due', NEVER 'missed'!
    assert doses[0]["status"] in ("pending", "due")
    assert doses[0]["status"] != "missed"


@pytest.mark.asyncio
async def test_medicine_expiry_and_refill_alerts(client: AsyncClient):
    """Alerts endpoint surfaces medicines needing refill, expiring soon, or expired."""
    token, _ = await create_user_and_token(client, "alerts_user@example.com", "Alerts User")

    today = date.today()
    exp_soon = (today + timedelta(days=10)).isoformat()
    already_exp = (today - timedelta(days=5)).isoformat()

    # 1. Low refill medicine
    await client.post(
        "/api/v1/medicines",
        json={
            "name": "Insulin Glargine",
            "current_quantity": 3,
            "refill_threshold": 5,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 2. Expiring soon medicine
    await client.post(
        "/api/v1/medicines",
        json={
            "name": "Eye Drops",
            "expiry_date": exp_soon,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # 3. Expired medicine
    await client.post(
        "/api/v1/medicines",
        json={
            "name": "Antibiotic Ointment",
            "expiry_date": already_exp,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    alerts_res = await client.get(
        "/api/v1/medicines/alerts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert alerts_res.status_code == 200
    data = alerts_res.json()

    assert any(m["name"] == "Insulin Glargine" for m in data["low_refill"])
    assert any(m["name"] == "Eye Drops" for m in data["expiring_soon"])
    assert any(m["name"] == "Antibiotic Ointment" for m in data["expired"])


@pytest.mark.asyncio
async def test_notification_provider_status_unconfigured_honest_response(client: AsyncClient):
    """External SMS provider correctly reports unconfigured and does not claim messages sent."""
    token, _ = await create_user_and_token(client, "remind_user@example.com", "Reminder User")

    status_res = await client.get(
        "/api/v1/medicines/reminders/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res.status_code == 200
    data = status_res.json()

    assert data["in_app_enabled"] is True
    assert data["external_delivery_available"] is False
    assert "not configured" in data["message"].lower()


@pytest.mark.asyncio
async def test_adherence_history_calculation(client: AsyncClient):
    """Adherence summary computes intake percentages over time."""
    token, _ = await create_user_and_token(client, "adh_user@example.com", "Adherence User")

    create_res = await client.post(
        "/api/v1/medicines",
        json={"name": "Vitamin D3", "strength": "1000 IU"},
        headers={"Authorization": f"Bearer {token}"},
    )
    med_id = create_res.json()["id"]

    now = datetime.now(timezone.utc)
    # Log 3 doses: 2 taken, 1 skipped
    await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={"scheduled_time": (now - timedelta(days=2)).isoformat(), "status": "taken"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={"scheduled_time": (now - timedelta(days=1)).isoformat(), "status": "taken"},
        headers={"Authorization": f"Bearer {token}"},
    )
    await client.post(
        f"/api/v1/medicines/{med_id}/doses",
        json={"scheduled_time": now.isoformat(), "status": "skipped"},
        headers={"Authorization": f"Bearer {token}"},
    )

    history_res = await client.get(
        "/api/v1/medicines/doses/history?days=7",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert history_res.status_code == 200
    adh = history_res.json()

    assert adh["total_scheduled"] == 3
    assert adh["taken"] == 2
    assert adh["skipped"] == 1
    # 2 / 3 = 66.7%
    assert adh["adherence_rate_percent"] == 66.7
