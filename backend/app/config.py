"""Application configuration — reads from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration loaded from environment variables."""

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

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

    model_config = {"env_file": (".env", "../.env"), "extra": "ignore"}


settings = Settings()  # type: ignore[call-arg]
