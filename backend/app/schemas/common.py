"""Shared / common response schemas."""

from pydantic import BaseModel


class MessageResponse(BaseModel):
    """Generic message response."""

    message: str


class ErrorResponse(BaseModel):
    """Structured error response — never exposes internals."""

    detail: str
