"""Document storage and management service."""

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document
from app.services.reports import ALLOWED_EXTENSIONS, get_storage_dir, validate_file_content


async def save_uploaded_document(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
    title: str,
    document_type: str,
    notes: str | None,
    upload_file: UploadFile,
) -> Document:
    original_filename = upload_file.filename or ""
    original_filename = Path(original_filename).name.strip()
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

    max_size = settings.MAX_UPLOAD_SIZE_BYTES
    content_chunks = []
    total_bytes = 0

    chunk_size = 1024 * 1024
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

    declared_mime = upload_file.content_type or ALLOWED_EXTENSIONS[ext]
    canonical_mime = validate_file_content(full_content, ext, declared_mime)

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    storage_dir = get_storage_dir()
    destination = storage_dir / safe_filename

    if not destination.resolve().is_relative_to(storage_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage destination.",
        )

    try:
        with open(destination, "wb") as f:
            f.write(full_content)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store the uploaded file.",
        ) from exc

    document = Document(
        user_id=user_id,
        profile_id=profile_id,
        title=title,
        document_type=document_type,
        notes=notes,
        filename=original_filename,
        file_path=safe_filename,
        mime_type=canonical_mime,
        file_size=total_bytes,
    )
    db.add(document)

    try:
        await db.flush()
        await db.refresh(document)
    except Exception:
        if destination.exists():
            destination.unlink(missing_ok=True)
        raise

    return document


async def list_user_documents(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> list[Document]:
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id, Document.profile_id == profile_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_user_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Document | None:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    return result.scalar_one_or_none()


def get_document_file_path(document: Document) -> Path:
    storage_dir = get_storage_dir()
    file_path = storage_dir / document.file_path
    if not file_path.resolve().is_relative_to(storage_dir) or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on storage.",
        )
    return file_path
