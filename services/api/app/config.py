"""Application configuration with feature detection for optional integrations."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Core
    database_url: str = "sqlite:///./padforward.db"
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )
    demo_mode: bool = True

    # Optional integrations — the app degrades gracefully without them.
    # AI provider: "auto" (gemini → openai-compatible → deterministic),
    # "gemini", "openai" (any OpenAI-compatible endpoint: OpenAI, Ollama,
    # LM Studio, vLLM, LiteLLM proxy for Claude/Copilot), or "none".
    ai_provider: str = "auto"
    gemini_api_key: str = ""
    openai_base_url: str = ""  # e.g. http://localhost:11434/v1 for Ollama
    openai_api_key: str = ""  # optional — local servers usually don't need one
    openai_model: str = ""  # e.g. llama3.1, gpt-4o-mini, claude-sonnet-4-5
    google_maps_api_key: str = ""
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    elevenlabs_api_key: str = ""

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def openai_enabled(self) -> bool:
        return bool(self.openai_base_url and self.openai_model)

    @property
    def google_maps_enabled(self) -> bool:
        return bool(self.google_maps_api_key)

    @property
    def snowflake_enabled(self) -> bool:
        return bool(self.snowflake_account and self.snowflake_user)


@lru_cache
def get_settings() -> Settings:
    return Settings()
