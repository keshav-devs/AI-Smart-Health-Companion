"""Pydantic schemas for authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Requests ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    """Body for POST /register."""

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Body for POST /login."""

    email: EmailStr
    password: str = Field(min_length=1)


# ── Responses ─────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    """Public representation of a user."""

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT token returned after successful login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
