"""User ORM model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.profile import Profile
    from app.models.medicine import Medicine
    from app.models.report import Report
    from app.models.document import Document
    from app.models.journal import JournalEntry
    from app.models.doctor_question import DoctorQuestion
    from app.models.contact import Contact
    from app.models.notification import Notification


class User(Base):
    """Application user — currently supports the 'patient' role."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="patient")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    reports: Mapped[list["Report"]] = relationship(
        "Report", back_populates="owner", cascade="all, delete-orphan"
    )
    medicines: Mapped[list["Medicine"]] = relationship(
        "Medicine", back_populates="owner", cascade="all, delete-orphan"
    )
    profiles: Mapped[list["Profile"]] = relationship(
        "Profile", back_populates="owner", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="owner", cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list["JournalEntry"]] = relationship(
        "JournalEntry", back_populates="owner", cascade="all, delete-orphan"
    )
    doctor_questions: Mapped[list["DoctorQuestion"]] = relationship(
        "DoctorQuestion", back_populates="owner", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        "Contact", back_populates="owner", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        "Notification", back_populates="owner", cascade="all, delete-orphan"
    )
