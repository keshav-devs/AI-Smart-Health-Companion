"""Documents router."""

import uuid
from typing import List

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
from app.schemas.document import DocumentResponse
from app.services.documents import (
    delete_user_document,
    get_document_file_path,
    get_user_document,
    list_user_documents,
    save_uploaded_document,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    title: str = Form(...),
    document_type: str = Form(...),
    notes: str | None = Form(None),
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    from app.services.profiles import get_user_profile
    profile = await get_user_profile(db, profile_id, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=403, detail="Profile access denied.")

    document = await save_uploaded_document(
        db=db,
        user_id=current_user.id,
        profile_id=profile_id,
        title=title,
        document_type=document_type,
        notes=notes,
        upload_file=file,
    )
    return DocumentResponse.model_validate(document)


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DocumentResponse]:
    documents = await list_user_documents(db, current_user.id, profile_id)
    return [DocumentResponse.model_validate(d) for d in documents]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document_details(
    document_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    document = await get_user_document(db, document_id, current_user.id, profile_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await delete_user_document(db, document_id, current_user.id, profile_id)


@router.get("/{document_id}/file")
@router.get("/{document_id}/download")
async def get_document_file(
    document_id: uuid.UUID,
    disposition: str = "attachment",
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    document = await get_user_document(db, document_id, current_user.id, profile_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    file_path = get_document_file_path(document)
    disp_type = "inline" if disposition == "inline" else "attachment"

    return FileResponse(
        path=file_path,
        media_type=document.mime_type,
        filename=document.filename,
        content_disposition_type=disp_type,
    )
