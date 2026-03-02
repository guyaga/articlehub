"""Application configuration loaded from environment variables.

Uses pydantic-settings to validate and parse all required configuration
from .env files or environment variables at startup.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Sentinel worker.

    All values are loaded from environment variables or a .env file located
    in the project root.  Validation happens at instantiation time so the
    application fails fast on missing / malformed config.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- Supabase -----------------------------------------------------------
    supabase_url: str
    supabase_service_role_key: str

    # --- Anthropic (Claude) -------------------------------------------------
    anthropic_api_key: str

    # --- Firecrawl ----------------------------------------------------------
    firecrawl_api_key: str

    # --- Resend (email) -----------------------------------------------------
    resend_api_key: str

    # --- General ------------------------------------------------------------
    environment: Literal["development", "staging", "production"] = "development"

    # Scheduled scan times in HH:MM format (Asia/Jerusalem)
    scan_times: list[str] = ["08:00", "14:30"]

    # Relevance threshold for headline scoring (0.0 - 1.0)
    relevance_threshold: float = 0.5

    # Maximum concurrent scraping tasks
    max_concurrent_scrapes: int = 10

    # Firecrawl API base URL
    firecrawl_base_url: str = "https://api.firecrawl.dev/v1"

    @property
    def is_production(self) -> bool:
        """Return True when running in production."""
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings singleton.

    The first call reads from the environment / .env file. Subsequent
    calls return the same instance.
    """
    return Settings()  # type: ignore[call-arg]
