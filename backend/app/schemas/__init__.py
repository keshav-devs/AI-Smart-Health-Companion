"""Schemas package."""

from app.schemas.auth import (  # noqa: F401
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.common import ErrorResponse, MessageResponse  # noqa: F401
from app.schemas.report import (  # noqa: F401
    ConfirmExtractionRequest,
    LabTestItem,
    ReportExtractionResult,
    ReportListResponse,
    ReportResponse,
)
from app.schemas.explanation import (  # noqa: F401
    ReportExplanationResult,
    ReportQuestionRequest,
    ReportQuestionResponse,
    TestExplanationItem,
)
from app.schemas.trends import (  # noqa: F401
    ReportTrendsResponse,
    TestComparisonPoint,
    TestDataPoint,
    TestTrendSummary,
)
from app.schemas.medicine import (  # noqa: F401
    AdherenceSummary,
    DoseLogCreate,
    DoseLogResponse,
    MedicineAlertsResponse,
    MedicineCreate,
    MedicineListResponse,
    MedicineResponse,
    MedicineScheduleCreate,
    MedicineScheduleResponse,
    MedicineScheduleUpdate,
    MedicineUpdate,
    ReminderProviderStatusResponse,
    TodayDoseItem,
    TodayDosesResponse,
)

from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse  # noqa: F401
from app.schemas.journal import JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse  # noqa: F401
from app.schemas.doctor_question import DoctorQuestionCreate, DoctorQuestionUpdate, DoctorQuestionResponse  # noqa: F401
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse  # noqa: F401
from app.schemas.notification import NotificationCreate, NotificationUpdate, NotificationResponse  # noqa: F401
