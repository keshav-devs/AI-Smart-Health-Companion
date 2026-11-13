"""Report explanation and question answering service."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report
from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
)
from app.schemas.report import ReportExtractionResult
from app.services.ai import (
    AIConfigurationError,
    AIParseError,
    AIServiceError,
    get_ai_provider,
)
from app.services.reports import get_user_report

logger = logging.getLogger(__name__)


async def generate_user_report_explanation(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ReportExplanationResult:
    """Generate an educational plain-English explanation for a confirmed report.

    Rules:
    - User ownership verified first (raises 404 if not found).
    - Report must be in 'analyzed' status (raises 400 if unconfirmed/pending).
    - If AI provider is unconfigured, raises 503 with clear message.
    - If AI provider fails, raises 502/503. Never substitutes fake data.
    - Result is saved to report.explanation_data.
    """
    report = await get_user_report(db, report_id, user_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only confirmed lab reports can be explained. Please review and confirm test results first.",
        )

    if not report.extracted_data or not isinstance(report.extracted_data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No confirmed test data found in this report to explain.",
        )

    try:
        extraction_model = ReportExtractionResult.model_validate(report.extracted_data)
    except Exception as exc:
        logger.error("Failed to parse confirmed extraction data for report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Corrupted confirmed report data.",
        ) from exc

    provider = get_ai_provider()

    try:
        explanation = await provider.explain_report(
            extraction=extraction_model,
            report_date=extraction_model.report_date_detected,
        )
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("Unexpected explanation failure for report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating explanation.",
        ) from exc

    # Persist generated explanation on report
    report.explanation_data = explanation.model_dump()
    await db.commit()
    await db.refresh(report)

    return explanation


async def answer_user_report_question(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    request: ReportQuestionRequest,
) -> ReportQuestionResponse:
    """Answer a focused user question scoped strictly to the confirmed report.

    Rules:
    - User ownership verified first (raises 404 if not found).
    - Report must be in 'analyzed' status (raises 400 if unconfirmed/pending).
    - Scoped strictly to this report; unrelated user records or db data are NEVER included.
    - If AI provider is unconfigured, raises 503.
    """
    report = await get_user_report(db, report_id, user_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    if report.status != "analyzed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Follow-up questions are only available for confirmed reports. Please confirm results first.",
        )

    if not report.extracted_data or not isinstance(report.extracted_data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No confirmed test data found in this report.",
        )

    try:
        extraction_model = ReportExtractionResult.model_validate(report.extracted_data)
    except Exception as exc:
        logger.error("Failed to parse confirmed extraction data for report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Corrupted confirmed report data.",
        ) from exc

    provider = get_ai_provider()

    try:
        answer_response = await provider.answer_report_question(
            extraction=extraction_model,
            request=request,
            report_date=extraction_model.report_date_detected,
        )
    except AIConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except AIParseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except AIServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("Unexpected question failure for report %s: %s", report_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while generating answer.",
        ) from exc

    return answer_response
