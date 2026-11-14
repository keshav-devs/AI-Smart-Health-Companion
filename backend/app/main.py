"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routers import (
    auth,
    chat,
    contacts,
    doctor_questions,
    documents,
    emergency,
    health,
    hospitals,
    journal,
    medicines,
    notifications,
    profiles,
    reports,
    timeline,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Ensure database schema is initialized on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="AI Smart Health Companion",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(medicines.router, prefix="/api/v1")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(journal.router, prefix="/api/v1")
app.include_router(doctor_questions.router, prefix="/api/v1")
app.include_router(contacts.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(timeline.router, prefix="/api/v1")
app.include_router(emergency.router, prefix="/api/v1")
app.include_router(hospitals.router, prefix="/api/v1")

# ── Global exception handler ─────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request, _exc: Exception
) -> JSONResponse:
    """Catch-all — never expose internal tracebacks to clients."""
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )
