"""Profile-scoped chronological health activity timeline."""

from datetime import date, datetime, time, timezone
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_active_profile_id, get_current_user
from app.models.document import Document
from app.models.journal import JournalEntry
from app.models.medicine import DoseLog, Medicine
from app.models.report import Report
from app.models.user import User

router = APIRouter(prefix="/timeline", tags=["health_timeline"])


class TimelineEvent(BaseModel):
    id: str
    category: Literal["report", "document", "medicine", "dose", "journal"]
    title: str
    summary: str
    occurred_at: datetime


def _as_datetime(value: datetime | date) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


@router.get("", response_model=list[TimelineEvent])
async def get_timeline(
    limit: int = Query(default=50, ge=1, le=100),
    profile_id: uuid.UUID = Depends(get_active_profile_id),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TimelineEvent]:
    owner_profile = (Report.user_id == current_user.id, Report.profile_id == profile_id)
    events: list[TimelineEvent] = []

    reports = (await db.execute(
        select(Report).where(*owner_profile).order_by(Report.created_at.desc()).limit(150)
    )).scalars().all()
    for report in reports:
        events.append(TimelineEvent(
            id=f"report:{report.id}", category="report", title="Lab report uploaded",
            summary=f"{report.report_type or 'Health report'} · {report.filename} · {report.status.replace('_', ' ')}",
            occurred_at=_as_datetime(report.created_at),
        ))

    documents = (await db.execute(select(Document).where(
        Document.user_id == current_user.id, Document.profile_id == profile_id,
    ).order_by(Document.created_at.desc()).limit(150))).scalars().all()
    for document in documents:
        events.append(TimelineEvent(
            id=f"document:{document.id}", category="document", title="Health document added",
            summary=f"{document.title} · {document.document_type}",
            occurred_at=_as_datetime(document.created_at),
        ))

    medicines = (await db.execute(select(Medicine).where(
        Medicine.user_id == current_user.id, Medicine.profile_id == profile_id,
    ).order_by(Medicine.created_at.desc()).limit(150))).scalars().all()
    for medicine in medicines:
        events.append(TimelineEvent(
            id=f"medicine:{medicine.id}", category="medicine",
            title="Medicine record",
            summary=" · ".join(part for part in (medicine.name, medicine.strength) if part),
            occurred_at=_as_datetime(medicine.created_at),
        ))

    doses = (await db.execute(select(DoseLog).options(selectinload(DoseLog.medicine)).where(
        DoseLog.user_id == current_user.id, DoseLog.profile_id == profile_id,
    ).order_by(DoseLog.scheduled_time.desc()).limit(150))).scalars().all()
    for dose in doses:
        events.append(TimelineEvent(
            id=f"dose:{dose.id}", category="dose", title=f"Medicine dose {dose.status}",
            summary=dose.medicine.name,
            occurred_at=_as_datetime(dose.actual_time or dose.scheduled_time),
        ))

    entries = (await db.execute(select(JournalEntry).where(
        JournalEntry.user_id == current_user.id, JournalEntry.profile_id == profile_id,
    ).order_by(JournalEntry.date.desc()).limit(150))).scalars().all()
    for entry in entries:
        tags = list(entry.symptoms or [])
        summary_parts = [part for part in (entry.mood, f"Sleep: {entry.sleep_hours:g}h" if entry.sleep_hours is not None else None) if part]
        summary_parts.extend(str(tag) for tag in tags[:5])
        events.append(TimelineEvent(
            id=f"journal:{entry.id}", category="journal", title="Journal entry",
            summary=" · ".join(summary_parts) or "Health notes recorded",
            occurred_at=_as_datetime(entry.date),
        ))

    events.sort(key=lambda event: event.occurred_at, reverse=True)
    return events[:limit]
