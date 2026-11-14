"""Profile ORM model."""

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.report import Report
    from app.models.medicine import Medicine, MedicineSchedule, DoseLog
    from app.models.document import Document
    from app.models.journal import JournalEntry
    from app.models.doctor_question import DoctorQuestion
    from app.models.contact import Contact


class Profile(Base):
    """User profile for family members."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False, default="Self") # e.g., "Self", "Spouse", "Child"
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional emergency & personal medical profile details
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    blood_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    allergies: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    owner: Mapped["User"] = relationship("User", back_populates="profiles")
    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="profile", cascade="all, delete-orphan"
    )
    medicines: Mapped[list["Medicine"]] = relationship(
        "Medicine", back_populates="profile", cascade="all, delete-orphan"
    )
    medicine_schedules: Mapped[list["MedicineSchedule"]] = relationship(
        "MedicineSchedule", back_populates="profile", cascade="all, delete-orphan"
    )
    dose_logs: Mapped[list["DoseLog"]] = relationship(
        "DoseLog", back_populates="profile", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="profile", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="profile", cascade="all, delete-orphan"
    )
    doctor_questions: Mapped[list["DoctorQuestion"]] = relationship(
        "DoctorQuestion", back_populates="profile", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        "Contact", back_populates="profile", cascade="all, delete-orphan"
    )
