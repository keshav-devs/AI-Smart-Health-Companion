"""AI explanation and question provider abstraction and exceptions."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
)
from app.schemas.report import ReportExtractionResult


class AIConfigurationError(Exception):
    """Raised when the AI provider is not configured (e.g. missing API key)."""


class AIServiceError(Exception):
    """Raised when an external AI provider fails or times out."""


class AIParseError(Exception):
    """Raised when an AI provider returns invalid or unparseable output."""


class AIExplanationProvider(ABC):
    """Abstract interface for AI report explanation and question answering."""

    @abstractmethod
    async def explain_report(
        self,
        extraction: ReportExtractionResult,
        report_date: str | None = None,
    ) -> ReportExplanationResult:
        """Generate a structured, safe explanation for confirmed lab results."""
        pass

    @abstractmethod
    async def answer_report_question(
        self,
        extraction: ReportExtractionResult,
        request: ReportQuestionRequest,
        report_date: str | None = None,
    ) -> ReportQuestionResponse:
        """Answer a focused question strictly about the confirmed report."""
        pass
