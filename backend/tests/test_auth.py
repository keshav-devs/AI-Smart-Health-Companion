"""Automated tests for health check and authentication flows."""

import uuid
import pytest
from httpx import AsyncClient

from app.models.user import User


# ── Health Endpoint Tests ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """GET /api/v1/health readiness probe returns 200 and ok message."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"message": "ok"}


# ── Registration Tests ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Registering with valid data returns 201, token, and user payload."""
    payload = {
        "email": "sarah.connor@example.com",
        "full_name": "Sarah Connor",
        "password": "SecurePassword123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "sarah.connor@example.com"
    assert data["user"]["full_name"] == "Sarah Connor"
    assert data["user"]["role"] == "patient"
    assert "password" not in data["user"]
    assert "hashed_password" not in data["user"]


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering with an already-used email returns 409 Conflict."""
    payload = {
        "email": "duplicate@example.com",
        "full_name": "First User",
        "password": "SecurePassword123!",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    """Invalid email format returns 422 Unprocessable Entity."""
    payload = {
        "email": "not-an-email",
        "full_name": "Test User",
        "password": "SecurePassword123!",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    """Password under 8 characters returns 422."""
    payload = {
        "email": "short@example.com",
        "full_name": "Short Password",
        "password": "12345",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


# ── Login Tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Logging in with correct credentials returns 200 and access token."""
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "login.test@example.com",
            "full_name": "Login Tester",
            "password": "ValidPassword999!",
        },
    )

    # Login
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "login.test@example.com",
            "password": "ValidPassword999!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login.test@example.com"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Logging in with incorrect password returns 401."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrong.pass@example.com",
            "full_name": "Wrong Pass",
            "password": "CorrectPassword123!",
        },
    )

    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "wrong.pass@example.com",
            "password": "WrongPassword999!",
        },
    )
    assert response.status_code == 401
    assert "invalid email or password" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Logging in with unknown email returns 401."""
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "does.not.exist@example.com",
            "password": "Password123!",
        },
    )
    assert response.status_code == 401


# ── Protected Current User /me Tests ───────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    """GET /api/v1/auth/me with valid Bearer token returns current user profile."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "me.test@example.com",
            "full_name": "Profile Owner",
            "password": "StrongPassword888!",
        },
    )
    token = reg.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    user_data = response.json()
    assert user_data["email"] == "me.test@example.com"
    assert user_data["full_name"] == "Profile Owner"
    assert user_data["role"] == "patient"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    """GET /api/v1/auth/me without token returns 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """GET /api/v1/auth/me with bogus token returns 401."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert response.status_code == 401


# ── Logout Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_logout_authenticated(client: AsyncClient):
    """POST /api/v1/auth/logout with token returns 200."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "logout.test@example.com",
            "full_name": "Logout Tester",
            "password": "StrongPassword777!",
        },
    )
    token = reg.json()["access_token"]

    response = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "logged out" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_logout_unauthenticated(client: AsyncClient):
    """POST /api/v1/auth/logout without token returns 401."""
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401
