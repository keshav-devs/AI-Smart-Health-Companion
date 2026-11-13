"""Report storage and validation service."""

import os
from pathlib import Path
import uuid
from typing import Any, BinaryIO

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.report import Report


ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

# Magic numbers for content verification
PDF_MAGIC = b"%PDF"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def get_storage_dir() -> Path:
    """Return the resolved storage directory and ensure it exists."""
    storage_dir = Path(settings.UPLOAD_DIR).resolve()
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def validate_file_content(content: bytes, extension: str, declared_mime: str) -> str:
    """Validate magic bytes against extension and declared MIME.

    Returns the canonical MIME type or raises HTTPException.
    """
    ext = extension.lower()
    if ext == ".pdf":
        if not content.startswith(PDF_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file. The file header does not match PDF format.",
            )
        return "application/pdf"
    elif ext in (".jpg", ".jpeg"):
        if not content.startswith(JPEG_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JPEG image. The file header does not match JPEG format.",
            )
        return "image/jpeg"
    elif ext == ".png":
        if not content.startswith(PNG_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PNG image. The file header does not match PNG format.",
            )
        return "image/png"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{extension}'. Only PDF, JPG, and PNG are allowed.",
        )


async def save_uploaded_report(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    upload_file: UploadFile,
    report_type: str | None = None,
) -> Report:
    """Validate, store securely on disk, and record report metadata in database."""
    # 1. Validate original filename and extension
    original_filename = upload_file.filename or ""
    original_filename = Path(original_filename).name.strip()  # Strip any directory path
    if not original_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid filename must be provided.",
        )

    _, ext = os.path.splitext(original_filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF, JPG, and PNG files are allowed.",
        )

    # 2. Read content in chunks to check size & magic bytes
    max_size = settings.MAX_UPLOAD_SIZE_BYTES
    content_chunks = []
    total_bytes = 0

    chunk_size = 1024 * 1024  # 1 MB chunk
    while True:
        chunk = await upload_file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_size // (1024 * 1024)} MB.",
            )
        content_chunks.append(chunk)

    if total_bytes == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    full_content = b"".join(content_chunks)

    # 3. Validate content magic bytes and determine canonical MIME type
    declared_mime = upload_file.content_type or ALLOWED_EXTENSIONS[ext]
    canonical_mime = validate_file_content(full_content, ext, declared_mime)

    # 4. Generate safe random filename to prevent collisions & path traversal
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    storage_dir = get_storage_dir()
    destination = storage_dir / safe_filename

    # Ensure destination is within storage directory
    if not destination.resolve().is_relative_to(storage_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage destination.",
        )

    # 5. Write file to disk
    try:
        with open(destination, "wb") as f:
            f.write(full_content)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store the uploaded file.",
        ) from exc

    # 6. Save metadata to database
    report = Report(
        user_id=user_id,
        profile_id=profile_id,
        filename=original_filename,
        file_path=safe_filename,
        report_type=report_type.strip() if report_type and report_type.strip() else None,
        mime_type=canonical_mime,
        file_size=total_bytes,
        status="not_analyzed",
    )
    db.add(report)

    try:
        await db.flush()
        await db.refresh(report)
    except Exception:
        # If DB fails, clean up the file
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise

    return report


async def list_user_reports(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> list[Report]:
    """Retrieve all reports owned by the specified user and profile, ordered newest first."""
    result = await db.execute(
        select(Report)
        .where(Report.user_id == user_id, Report.profile_id == profile_id)
        .order_by(Report.created_at.desc())
    )
    return list(result.scalars().all())


async def get_user_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Report | None:
    """Retrieve a specific report ensuring user ownership."""
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.user_id == user_id)
    )
    return result.scalar_one_or_none()


def get_report_file_path(report: Report) -> Path:
    """Return the absolute path of the report file on disk."""
    storage_dir = get_storage_dir()
    file_path = storage_dir / report.file_path
    if not file_path.resolve().is_relative_to(storage_dir) or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found on storage.",
        )
    return file_path


async def analyze_user_report(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Report:
    """Read the report file, invoke Gemini AI extraction, and store results.

    Verifies user ownership before accessing file or invoking AI.
    """
    report = await get_user_report(db, report_id, user_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    file_path = get_report_file_path(report)
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read report file for analysis.",
        ) from exc

    # Import extractor service
    from app.services.gemini_extractor import (
        GeminiConfigurationError,
        GeminiExtractionError,
        GeminiServiceError,
        extract_report_data,
    )

    report.status = "processing"
    report.extraction_error = None
    await db.flush()

    try:
        extraction_result = await extract_report_data(
            file_bytes=file_bytes,
            mime_type=report.mime_type,
            filename=report.filename,
        )
    except GeminiConfigurationError as exc:
        report.status = "failed"
        report.extraction_error = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except GeminiExtractionError as exc:
        report.status = "failed"
        report.extraction_error = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except GeminiServiceError as exc:
        report.status = "failed"
        report.extraction_error = str(exc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        report.status = "failed"
        report.extraction_error = "An unexpected error occurred during report extraction."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during report extraction.",
        ) from exc

    # Success: Save extracted data into report and mark for user review
    report.extracted_data = extraction_result.model_dump()
    report.status = "needs_review"
    report.extraction_error = None
    await db.commit()
    await db.refresh(report)
    return report


async def confirm_user_report_extraction(
    db: AsyncSession,
    report_id: uuid.UUID,
    user_id: uuid.UUID,
    data: Any,
) -> Report:
    """Explicitly confirm and save user-verified extracted lab data or manually entered data.

    Changes status to 'analyzed' or 'manually_entered' and records reviewed_at timestamp.
    """
    from datetime import datetime, timezone
    from app.schemas.report import ConfirmExtractionRequest, STANDARD_MEDICAL_DISCLAIMER
    from app.utils.lab_parser import compute_test_status

    report = await get_user_report(db, report_id, user_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    confirm_data: ConfirmExtractionRequest = data
    
    is_manual = False
    if not report.extracted_data:
        # This is a manual entry without prior AI analysis
        is_manual = True
        current_data = {
            "patient_name_detected": None,
            "report_date_detected": None,
            "lab_name_detected": None,
            "tests": [],
            "disclaimer": "", # No AI disclaimer for manual entry
            "summary_notes": None,
            "provenance": "manual",
        }
    else:
        current_data = dict(report.extracted_data)
        current_data["provenance"] = "ai"

    # Compute deterministic status for each test
    processed_tests = []
    for test in confirm_data.tests:
        test_dump = test.model_dump()
        computed_status = compute_test_status(test_dump.get("value"), test_dump.get("reference_range"))
        if computed_status != "unspecified":
            test_dump["status"] = computed_status
        # If still unspecified and numeric range was uninterpretable, ensure it flags review
        if test_dump.get("status") == "unspecified" and test_dump.get("reference_range"):
            test_dump["needs_review"] = True
            if not test_dump.get("review_reason"):
                test_dump["review_reason"] = "Could not deterministically parse reference range."
        processed_tests.append(test_dump)

    current_data["tests"] = processed_tests
    if confirm_data.patient_name_detected is not None:
        current_data["patient_name_detected"] = confirm_data.patient_name_detected
    if confirm_data.report_date_detected is not None:
        current_data["report_date_detected"] = confirm_data.report_date_detected
    if confirm_data.lab_name_detected is not None:
        current_data["lab_name_detected"] = confirm_data.lab_name_detected
    if confirm_data.notes is not None:
        current_data["summary_notes"] = confirm_data.notes

    report.extracted_data = current_data
    report.status = "manually_entered" if is_manual else "analyzed"
    report.reviewed_at = datetime.now(timezone.utc)
    report.extraction_error = None

    await db.flush()
    await db.refresh(report)
    return report
