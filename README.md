# AI Smart Health Companion

A modern, trustworthy health-management web application built with React, FastAPI, and PostgreSQL.

## Architecture

| Layer      | Stack                                                       |
| ---------- | ----------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query    |
| Backend    | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2  |
| Database   | PostgreSQL 16                                               |
| Infra      | Docker Compose                                              |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2+

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and SECRET_KEY to real values
```

### 2. Start all services

```bash
make up
# or: docker compose up --build -d
```

### 3. Run database migrations

```bash
make migrate
# or: docker compose exec backend alembic upgrade head
```

### 4. Open the app

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

## Makefile Commands

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `make up`      | Build and start all services         |
| `make down`    | Stop and remove containers           |
| `make logs`    | Tail logs from all services          |
| `make migrate` | Run Alembic migrations               |
| `make shell`   | Open a shell in the backend container|

## Project Structure

```
├── backend/          # FastAPI application
│   ├── app/          # Application code
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── routers/  # API endpoints
│   └── alembic/      # Database migrations
├── frontend/         # React application
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── contexts/
│       └── api/
└── docker-compose.yml
```

## Current Milestone

**Milestone 1** — Project foundation with authentication:

- ✅ User registration and login
- ✅ JWT-based session management
- ✅ Protected dashboard with empty states
- ✅ Responsive design (desktop + mobile)
- ✅ Docker Compose deployment

## License

Private — All rights reserved.
