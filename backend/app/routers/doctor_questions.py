"""Doctor Questions router."""

import uuid
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_active_profile_id
from app.models.user import User
from app.models.doctor_question import DoctorQuestion
from app.schemas.doctor_question import DoctorQuestionCreate, DoctorQuestionUpdate, DoctorQuestionResponse
from app.schemas.health_ai import DoctorQuestionSuggestionsResponse
from app.models.medicine import Medicine
from app.models.report import Report
from app.schemas.report import ReportExtractionResult
from app.services.ai.base import AIConfigurationError, AIParseError, AIServiceError
from app.services.ai.health_assistant import generate_doctor_questions


router = APIRouter(prefix="/doctor-questions", tags=["doctor_questions"])


@router.post("/generate", response_model=DoctorQuestionSuggestionsResponse)
async def generate_questions(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionSuggestionsResponse:
    reports = (await db.execute(
        select(Report).where(
            Report.user_id == current_user.id,
            Report.profile_id == profile_id,
            Report.status == "analyzed",
        ).order_by(Report.created_at.desc()).limit(10)
    )).scalars().all()
    confirmed_results: list[dict] = []
    for report in reports:
        raw = report.extracted_data
        try:
            extraction = ReportExtractionResult.model_validate(raw) if raw else None
        except Exception:
            extraction = None
        if extraction:
            for test in extraction.tests:
                confirmed_results.append({
                    "test_name": test.test_name[:100],
                    "value": test.value[:60],
                    "unit": test.unit[:40] if test.unit else None,
                    "reference_range": test.reference_range[:80] if test.reference_range else None,
                    "status": test.status,
                })

    medicines = (await db.execute(
        select(Medicine).where(
            Medicine.user_id == current_user.id,
            Medicine.profile_id == profile_id,
            Medicine.is_active.is_(True),
        ).order_by(Medicine.updated_at.desc()).limit(20)
    )).scalars().all()
    medicine_context = [
        {"name": medicine.name[:100], "strength": medicine.strength[:60] if medicine.strength else None}
        for medicine in medicines
    ]
    if not confirmed_results and not medicine_context:
        return DoctorQuestionSuggestionsResponse(suggestions=[])
    try:
        return await generate_doctor_questions(confirmed_results, medicine_context)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (AIParseError, AIServiceError) as exc:
        raise HTTPException(status_code=503, detail="Question suggestions are temporarily unavailable.") from exc


@router.post("", response_model=DoctorQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_question(
    data: DoctorQuestionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionResponse:
    from app.services.profiles import get_user_profile
    profile = await get_user_profile(db, data.profile_id, current_user.id)
    if not profile or not profile.is_active:
        raise HTTPException(status_code=403, detail="Profile access denied.")

    question = DoctorQuestion(
        user_id=current_user.id,
        profile_id=data.profile_id,
        question=data.question,
        answer=data.answer,
        is_asked=data.is_asked,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return DoctorQuestionResponse.model_validate(question)


@router.get("", response_model=List[DoctorQuestionResponse])
async def list_doctor_questions(
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DoctorQuestionResponse]:
    result = await db.execute(
        select(DoctorQuestion)
        .where(DoctorQuestion.user_id == current_user.id, DoctorQuestion.profile_id == profile_id)
        .order_by(DoctorQuestion.created_at.desc())
    )
    questions = result.scalars().all()
    return [DoctorQuestionResponse.model_validate(q) for q in questions]


@router.put("/{question_id}", response_model=DoctorQuestionResponse)
async def update_doctor_question(
    question_id: uuid.UUID,
    data: DoctorQuestionUpdate,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorQuestionResponse:
    result = await db.execute(
        select(DoctorQuestion).where(
            DoctorQuestion.id == question_id,
            DoctorQuestion.user_id == current_user.id,
            DoctorQuestion.profile_id == profile_id,
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(question, key, value)

    await db.commit()
    await db.refresh(question)
    return DoctorQuestionResponse.model_validate(question)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor_question(
    question_id: uuid.UUID,
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DoctorQuestion).where(
            DoctorQuestion.id == question_id,
            DoctorQuestion.user_id == current_user.id,
            DoctorQuestion.profile_id == profile_id,
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found.")

    await db.delete(question)
    await db.commit()
