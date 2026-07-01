"""TwelveData provider (optional, free API key) for forex + gold.

Free tier is REST-only (8 req/min, 800/day) — no WebSocket — so "live" updates
come from polling, same as the Yahoo provider. Activated only when
TWELVEDATA_API_KEY is configured; otherwise these instruments use Yahoo.
Docs: https://twelvedata.com/docs
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.market.base import MarketDataProvider
from app.schemas.market import Candle

logger = logging.getLogger(__name__)

_URL = "https://api.twelvedata.com/time_series"

# App timeframe -> TwelveData interval (TwelveData supports 4h natively).
_INTERVAL_MAP = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1h",
    "4h": "4h",
    "1d": "1day",
    "1w": "1week",
    "1M": "1month",
}

_POLL_SECONDS = 15.0
_CACHE_TTL = 12.0


class _CacheEntry:
    __slots__ = ("candles", "ts")

    def __init__(self, candles: list[Candle], ts: float) -> None:
        self.candles = candles
        self.ts = ts


def _parse_dt(value: str) -> int:
    # TwelveData returns "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" (UTC requested).
    fmt = "%Y-%m-%d %H:%M:%S" if " " in value else "%Y-%m-%d"
    dt = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


class TwelveDataProvider(MarketDataProvider):
    name = "twelvedata"

    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()

    # One fetch per symbol+interval is shared by every caller (candles,
    # structure, signal, live poll) to stay within the free-tier rate limit.
    _OUTPUTSIZE = 500

    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        if interval not in _INTERVAL_MAP:
            raise ValueError(f"Unsupported interval for TwelveData: {interval}")

        # Cache key is independent of `limit` so all callers share one fetch.
        key = f"{native_symbol}:{interval}"
        now = time.monotonic()
        async with self._lock:
            entry = self._cache.get(key)
            if entry and (now - entry.ts) < _CACHE_TTL:
                return entry.candles[-limit:]

        params = {
            "symbol": native_symbol,
            "interval": _INTERVAL_MAP[interval],
            "outputsize": self._OUTPUTSIZE,
            "timezone": "UTC",
            "order": "ASC",
            "apikey": settings.twelvedata_api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(_URL, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except Exception:  # noqa: BLE001
            logger.exception("TwelveData fetch failed for %s %s", native_symbol, interval)
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        if payload.get("status") == "error":
            # Rate limit / quota — serve stale cache rather than wiping the chart.
            logger.warning("TwelveData error for %s: %s", native_symbol, payload.get("message"))
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        candles: list[Candle] = []
        for v in payload.get("values", []):
            candles.append(
                Candle(
                    time=_parse_dt(v["datetime"]),
                    open=float(v["open"]),
                    high=float(v["high"]),
                    low=float(v["low"]),
                    close=float(v["close"]),
                    volume=float(v.get("volume") or 0.0),
                )
            )
        candles.sort(key=lambda c: c.time)

        # Keep stale data if a sparse/empty response comes back.
        if not candles:
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        async with self._lock:
            self._cache[key] = _CacheEntry(candles, time.monotonic())
        return candles[-limit:]

    async def stream(  # type: ignore[override]
        self, native_symbol: str, interval: str
    ) -> AsyncIterator[Candle]:
        last_emitted: tuple[int, float] | None = None
        while True:
            candles = await self.get_candles(native_symbol, interval, limit=2)
            if candles:
                latest = candles[-1]
                fingerprint = (latest.time, latest.close)
                if fingerprint != last_emitted:
                    last_emitted = fingerprint
                    yield latest
            await asyncio.sleep(_POLL_SECONDS)


twelvedata_provider = TwelveDataProvider()
