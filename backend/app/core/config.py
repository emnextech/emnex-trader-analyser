"""Application settings loaded from environment / .env file."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration.

    Appwrite values are only required for auth; market data needs no keys.
    """

    # Appwrite (server SDK — used for future server-side DB writes)
    appwrite_endpoint: str = "https://cloud.appwrite.io/v1"
    appwrite_project_id: str = ""
    appwrite_api_key: str = ""

    # TwelveData (optional, free key) — when set, used for forex + gold instead
    # of Yahoo for better reliability. Leave blank to use keyless Yahoo.
    twelvedata_api_key: str = ""

    # AI Mentor (Phase 5). Provider-agnostic. Set AI_PROVIDER to groq | gemini |
    # anthropic and supply the matching key. Groq and Gemini have free tiers.
    # Leave all keys blank to disable the mentor; everything else works without it.
    ai_provider: str = "groq"
    groq_api_key: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    # Optional model override. Blank = use the active provider's sensible default.
    mentor_model: str = ""

    # Notifications (Module 15) — all optional. Desktop alerts work in-browser
    # without any of these; set these to also fan out to Discord/Telegram.
    discord_webhook_url: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # CORS: comma-separated origins, parsed into a list
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Allow any private-LAN origin (any port) so other devices on the same
    # network can use the app in dev. Matches localhost + 10.x / 192.168.x /
    # 172.16-31.x addresses. Set to "" to disable and rely on cors_origins only.
    cors_origin_regex: str = (
        r"http://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
