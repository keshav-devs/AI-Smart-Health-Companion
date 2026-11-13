"""Reports router — upload, list, retrieve, and download blood reports."""

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_active_profile_id
from app.models.user import User
from app.schemas.explanation import (
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
)
from app.schemas.report import ConfirmExtractionRequest, ReportListResponse, ReportResponse
from app.schemas.trends import ReportTrendsResponse
from app.services.report_explanation import (
    answer_user_report_question,
    generate_user_report_explanation,
)
from app.services.report_trends import compute_user_report_trends
from app.services.reports import (
    analyze_user_report,
    confirm_user_report_extraction,
    get_report_file_path,
    get_user_report,
    list_user_reports,
    save_uploaded_report,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_report(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    file: UploadFile = File(..., description="Blood report file (PDF, JPG, or PNG)"),
    report_type: str | None = Form(None, description="Optional category/type of the report"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Upload a new blood report for the signed-in patient."""
    from app.services.profiles import get_user_profile
    profile = await get_user_profile(db, profile_id, current_user.id)
    if not profile:
        raise HTTPException(status_code=403, detail="Profile access denied.")

    report = await save_uploaded_report(
        db=db,
        user_id=current_user.id,
        profile_id=profile_id,
        upload_file=file,
        report_type=report_type,
    )
    return ReportResponse.model_validate(report)


@router.get("", response_model=ReportListResponse)
async def list_reports(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportListResponse:
    """List all reports belonging to the current authenticated user and profile."""
    reports = await list_user_reports(db, current_user.id, profile_id)
    return ReportListResponse(
        reports=[ReportResponse.model_validate(r) for r in reports],
        total=len(reports),
    )


@router.get("/trends", response_model=ReportTrendsResponse)
async def get_report_trends(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportTrendsResponse:
    """Deterministic laboratory test trend analysis across confirmed reports."""
    return await compute_user_report_trends(db, current_user.id, profile_id)


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report_details(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Retrieve details of a report owned by the current authenticated user."""
    report = await get_user_report(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    return ReportResponse.model_validate(report)


@router.get("/{report_id}/file")
@router.get("/{report_id}/download")
async def get_report_file(
    report_id: uuid.UUID,
    disposition: str = "attachment",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    """Retrieve or download the original report file (owner only).

    - disposition=inline: Preview directly in browser/PDF viewer/image viewer
    - disposition=attachment: Download file with original filename
    """
    report = await get_user_report(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    file_path = get_report_file_path(report)
    disp_type = "inline" if disposition == "inline" else "attachment"

    return FileResponse(
        path=file_path,
        media_type=report.mime_type,
        filename=report.filename,
        content_disposition_type=disp_type,
    )


@router.post("/{report_id}/analyze", response_model=ReportResponse)
async def analyze_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Analyze an uploaded blood report with Gemini AI.

    Requires authenticated user ownership of the report.
    """
    report = await analyze_user_report(
        db=db,
        report_id=report_id,
        user_id=current_user.id,
    )
    return ReportResponse.model_validate(report)


@router.post("/{report_id}/confirm", response_model=ReportResponse)
async def confirm_extraction(
    report_id: uuid.UUID,
    data: ConfirmExtractionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Confirm and save user-reviewed extracted lab test results."""
    report = await confirm_user_report_extraction(
        db=db,
        report_id=report_id,
        user_id=current_user.id,
        data=data,
    )
    return ReportResponse.model_validate(report)


@router.post("/{report_id}/explain", response_model=ReportExplanationResult)
async def explain_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportExplanationResult:
    """Generate or retrieve a safe, educational AI explanation for a confirmed blood report."""
    return await generate_user_report_explanation(
        db=db,
        report_id=report_id,
        user_id=current_user.id,
    )


@router.get("/{report_id}/explanation", response_model=ReportExplanationResult)
async def get_report_explanation(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportExplanationResult:
    """Retrieve existing stored explanation for a confirmed report."""
    report = await get_user_report(db, report_id, current_user.id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    if not report.explanation_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No explanation has been generated for this report yet.",
        )
    return ReportExplanationResult.model_validate(report.explanation_data)


@router.post("/{report_id}/questions", response_model=ReportQuestionResponse)
async def ask_report_question(
    report_id: uuid.UUID,
    request: ReportQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportQuestionResponse:
    """Ask a question strictly scoped to the confirmed report results."""
    return await answer_user_report_question(
        db=db,
        report_id=report_id,
        user_id=current_user.id,
        request=request,
    )


