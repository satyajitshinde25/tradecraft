"""
Market Sprint — Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./market_sprint.db"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480  # 8 hours — covers a full event day
    ADMIN_PASSWORD: str = "admin123"
    CORS_ORIGINS: str = "http://localhost:5173"

    # Game defaults (1-hour contest: 96 ticks * 37.5s = 3600s = 60m)
    TICK_SECONDS: float = 37.5
    STARTING_BALANCE: float = 10000.00
    MAX_TRADES: int = 22
    BUY_LIMIT_PERCENT: float = 35.0
    CONCENTRATION_LIMIT_PERCENT: float = 60.0
    TRADE_FEE_PERCENT: float = 0.4
    COOLDOWN_SECONDS: int = 7

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
