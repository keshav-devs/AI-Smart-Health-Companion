"""Application configuration — reads from environment variables."""

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


KNOWN_INSECURE_SECRETS = {
    "",
    "change_me_to_a_secure_random_secret_key",
    "change_me_to_a_random_secret_key",
    "change-me-to-a-secure-random-secret-key",
    "change-me-to-a-random-secret-key",
    "change-me-in-production-secret-key-32b",
    "secret",
    "your_secret_key_here",
    "your-secret-key-here",
    "your_secret_key",
    "your-secret-key",
}


class Settings(BaseSettings):
    """Central configuration loaded from environment variables."""

    # Environment mode: "local", "test", or "production"
    ENVIRONMENT: str = "local"

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173"

    # Storage
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # Gemini AI
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Geoapify Places
    GEOAPIFY_API_KEY: str | None = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        """Ensure PostgreSQL URLs use the asyncpg driver (e.g., Render Postgres)."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
            if v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        """Fail fast in production if SECRET_KEY is missing or an insecure default."""
        if self.ENVIRONMENT.lower() == "production":
            key = (self.SECRET_KEY or "").strip()
            if not key or key.lower() in KNOWN_INSECURE_SECRETS:
                raise ValueError(
                    "SECRET_KEY must be set to a secure, non-default value when ENVIRONMENT is 'production'."
                )
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

    model_config = {"env_file": (".env", "../.env"), "extra": "ignore"}


settings = Settings()  # type: ignore[call-arg]
