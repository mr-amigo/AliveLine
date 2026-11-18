from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-insecure-secret-change-me-in-prod"


class Settings(BaseSettings):
    """Application configuration, read from environment variables (and optional .env)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    secret_key: str = DEV_SECRET
    database_url: str = "sqlite:///./aliveline.db"
    # Lambda + Aurora: no pooled connections, so the paused-when-idle database can actually pause.
    db_null_pool: bool = False
    cookie_name: str = "al_session"
    cookie_secure: bool = False
    jwt_expire_days: int = 7
    bcrypt_rounds: int = 12
    app_tz: str = "Europe/Kyiv"
    # AI estimates (AI Lambda / local dev): OpenAI when a key is set, otherwise heuristic. The backend Lambda sets none (no internet in its VPC).
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    openai_base_url: str | None = None  # for OpenAI-compatible providers
    llm_timeout_seconds: float = 15.0
    # Payments (Paddle Billing, merchant of record). Checkout shows only when the client token + prices are set,
    # and, outside production, only to BILLING_TESTERS (comma-separated emails).
    paddle_env: str = "sandbox"  # sandbox | production
    paddle_api_key: str | None = None  # AI Lambda only (customer portal; backend has no internet)
    paddle_client_token: str | None = None
    paddle_webhook_secret: str | None = None
    paddle_price_monthly: str | None = None
    paddle_price_yearly: str | None = None
    billing_testers: str = ""

    @model_validator(mode="after")
    def _normalize(self) -> "Settings":
        # Hosted Postgres providers hand out postgres:// URLs; SQLAlchemy needs the psycopg driver name.
        for prefix in ("postgres://", "postgresql://"):
            if self.database_url.startswith(prefix):
                self.database_url = "postgresql+psycopg://" + self.database_url[len(prefix):]
        if self.env == "prod" and self.secret_key == DEV_SECRET:
            raise ValueError("SECRET_KEY must be set in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
