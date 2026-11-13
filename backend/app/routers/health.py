"""Health-check router."""

from fastapi import APIRouter

from app.schemas.common import MessageResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=MessageResponse)
async def health_check() -> MessageResponse:
    """Readiness probe — returns OK when the service is running."""
    return MessageResponse(message="ok")
