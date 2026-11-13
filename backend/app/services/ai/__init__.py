"""AI service providers package."""

from __future__ import annotations

from app.config import settings
from app.services.ai.base import (
    AIConfigurationError,
    AIExplanationProvider,
    AIParseError,
    AIServiceError,
)
from app.services.ai.gemini_provider import GeminiAIProvider
from app.services.ai.mock_provider import MockAIProvider

_override_provider: AIExplanationProvider | None = None


def set_ai_provider(provider: AIExplanationProvider | None) -> None:
    """Set global override provider (used for tests or offline mode)."""
    global _override_provider
    _override_provider = provider


def get_ai_provider() -> AIExplanationProvider:
    """Get configured AI explanation provider."""
    if _override_provider is not None:
        return _override_provider
    return GeminiAIProvider()


__all__ = [
    "AIConfigurationError",
    "AIServiceError",
    "AIParseError",
    "AIExplanationProvider",
    "GeminiAIProvider",
    "MockAIProvider",
    "get_ai_provider",
    "set_ai_provider",
]
