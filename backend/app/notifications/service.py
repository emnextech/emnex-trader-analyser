"""Module 15 — Notifications: optional Discord / Telegram fan-out.

Desktop/browser alerts are handled client-side (no server needed). These helpers
push the same alert to Discord and/or Telegram when webhooks/tokens are set.
"""
from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def status() -> dict[str, bool]:
    return {
        "discord": bool(settings.discord_webhook_url),
        "telegram": bool(settings.telegram_bot_token and settings.telegram_chat_id),
    }


async def send_alert(title: str, message: str) -> list[str]:
    """Send an alert to all configured channels. Returns channels that succeeded."""
    sent: list[str] = []
    text = f"**{title}**\n{message}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        if settings.discord_webhook_url:
            try:
                resp = await client.post(
                    settings.discord_webhook_url, json={"content": text}
                )
                resp.raise_for_status()
                sent.append("discord")
            except Exception:  # noqa: BLE001
                logger.warning("Discord alert failed")

        if settings.telegram_bot_token and settings.telegram_chat_id:
            try:
                url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
                resp = await client.post(
                    url,
                    json={
                        "chat_id": settings.telegram_chat_id,
                        "text": f"{title}\n{message}",
                    },
                )
                resp.raise_for_status()
                sent.append("telegram")
            except Exception:  # noqa: BLE001
                logger.warning("Telegram alert failed")

    return sent
