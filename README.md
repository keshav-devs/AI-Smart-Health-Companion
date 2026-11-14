# AI Smart Health Companion

A responsive health-record MVP for patients and families. It combines a React/TypeScript frontend with a FastAPI backend, profile-scoped records, and optional Gemini-powered report education. This is a project/demo MVP, not clinical software.

## Current MVP features

- Account registration, login, and JWT-protected APIs.
- Family profiles with switching, add/edit/deactivate, and separate records per profile.
- Blood-report upload, preview/download, manual lab-value entry, review/confirmation, trends, and optional AI extraction/explanation/report questions.
- Medicine records, schedules, dose logging, inventory deduction, and adherence summaries.
- Health-document upload, download, and delete.
- Lifestyle/symptom journal and doctor-preparation questions with create/edit/delete flows.
- Profile-scoped emergency and care-team contacts.
- Active-profile data export as JSON.

## Technology

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic 2, Alembic |
| Database | PostgreSQL 16 |
| Development deployment | Docker Compose |
| Optional AI | Google Gemini through the server-side Python SDK |

## Start locally with Docker Desktop

1. In PowerShell, from the project root, copy the example environment file and edit the secrets:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set a strong `POSTGRES_PASSWORD` and `SECRET_KEY`. `GEMINI_API_KEY` may be left blank; report extraction and AI explanations will then return an honest configuration error. Keep the Gemini key only in the backend environment.

2. Start the app and database:

   ```powershell
   docker compose up --build -d
   docker compose exec backend alembic upgrade head
   ```

3. Open:

   - Frontend: http://localhost:5173
   - API health: http://localhost:8000/api/v1/health
   - API docs: http://localhost:8000/docs

Register a new account in the app; no demo account is seeded.

## Checks

From `frontend/`:

```powershell
npm run typecheck
npm run build
```

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

`backend/test_live_e2e.py` is a separate live-server script. Start the backend first, then run it directly with Python; pytest discovery will not execute it. It creates a disposable account and records in the configured database.

## Current integration limits

- Without a valid Gemini key and available quota, AI report extraction and AI explanations cannot be demonstrated.
- Scheduled SMS/WhatsApp delivery is not implemented; the app reports in-app dose tracking honestly and does not claim external messages were sent.
- This MVP does not connect to a hospital/EHR, interpret reports as a diagnosis, or prescribe treatment.
- Uploaded files use the configured local/container storage directory. A public deployment needs durable private object storage, backups, and production secrets.

## Structure

```text
backend/   FastAPI routes, services, models, migrations, tests
frontend/  React pages, API clients, profile/auth contexts
```
