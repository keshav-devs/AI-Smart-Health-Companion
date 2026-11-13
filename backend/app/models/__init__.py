"""ORM models package — import all models here so Alembic can discover them."""

from app.models.user import User  # noqa: F401
from app.models.profile import Profile  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.medicine import Medicine, MedicineSchedule, DoseLog  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.journal import JournalEntry  # noqa: F401
from app.models.doctor_question import DoctorQuestion  # noqa: F401
from app.models.contact import Contact  # noqa: F401
from app.models.notification import Notification  # noqa: F401

