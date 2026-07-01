"""Appwrite server-side client.

Used for future server-side database operations (trade journal, backtests).
Auth/login itself is handled by the frontend Appwrite Web SDK using sessions, so
this is optional at Phase 1. Returns None if Appwrite is not configured.
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings


@lru_cache
def get_appwrite_client():
    """Return a configured Appwrite Client, or None if env vars are unset."""
    if not (settings.appwrite_project_id and settings.appwrite_api_key):
        return None

    # Imported lazily so the backend runs without the SDK configured.
    from appwrite.client import Client

    client = Client()
    client.set_endpoint(settings.appwrite_endpoint)
    client.set_project(settings.appwrite_project_id)
    client.set_key(settings.appwrite_api_key)
    return client
