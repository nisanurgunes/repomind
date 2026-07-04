from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "DevPulse"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/devpulse"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_TOKEN: Optional[str] = None

    # Anthropic AI
    ANTHROPIC_API_KEY: Optional[str] = None

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_ID_PERSONAL_PRO: Optional[str] = None
    STRIPE_PRICE_ID_ORG_PRO: Optional[str] = None

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"  # .env'de model'de tanımlı olmayan bir anahtar varsa boot'u kırmasın

settings = Settings()