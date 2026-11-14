"""Authenticated, stateless general health-education chat endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.health_ai import HealthChatRequest, HealthChatResponse
from app.services.ai.base import AIConfigurationError, AIParseError, AIServiceError
from app.services.ai.health_assistant import answer_health_question

router = APIRouter(prefix="/chat", tags=["health_chat"])


@router.post("", response_model=HealthChatResponse)
async def chat(
    data: HealthChatRequest,
    _current_user: User = Depends(get_current_user),
) -> HealthChatResponse:
    try:
        return await answer_health_question(data.message)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except (AIParseError, AIServiceError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The health assistant is temporarily unavailable. Please try again later.",
        ) from exc
