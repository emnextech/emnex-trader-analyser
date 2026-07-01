"""OKX public market data provider (crypto) — keyless fallback for Binance.

Used when Binance is rate-limited (429) or geo-blocked (451). Free tier is
REST-only here, so live updates come from polling. Supports all our timeframes
(including 4h and 1M). Docs: https://www.okx.com/docs-v5/en/
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator

import httpx

from app.market.base import MarketDataProvider
from app.schemas.market import Candle

logger = logging.getLogger(__name__)

_URL = "https://www.okx.com/api/v5/market/candles"

# App timeframe -> OKX bar. Daily+ use UTC variants to align with Binance/Yahoo.
_INTERVAL_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1H",
    "4h": "4H",
    "1d": "1Dutc",
    "1w": "1Wutc",
    "1M": "1Mutc",
}

_CACHE_TTL = 10.0
_POLL_SECONDS = 10.0


def _to_instid(native_symbol: str) -> str:
    """BTCUSDT -> BTC-USDT (OKX instrument id)."""
    s = native_symbol.upper()
    for quote in ("USDT", "USDC", "USD"):
        if s.endswith(quote) and len(s) > len(quote):
            return f"{s[: -len(quote)]}-{quote}"
    return s


class _CacheEntry:
    __slots__ = ("candles", "ts")

    def __init__(self, candles: list[Candle], ts: float) -> None:
        self.candles = candles
        self.ts = ts


class OKXProvider(MarketDataProvider):
    name = "okx"

    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        if interval not in _INTERVAL_MAP:
            raise ValueError(f"Unsupported interval for OKX: {interval}")

        inst = _to_instid(native_symbol)
        key = f"{inst}:{interval}"
        now = time.monotonic()
        async with self._lock:
            entry = self._cache.get(key)
            if entry and (now - entry.ts) < _CACHE_TTL:
                return entry.candles[-limit:]

        params = {"instId": inst, "bar": _INTERVAL_MAP[interval], "limit": 300}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(_URL, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except Exception:  # noqa: BLE001
            logger.warning("OKX fetch failed for %s %s", inst, interval)
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        if payload.get("code") != "0":
            logger.warning("OKX error for %s: %s", inst, payload.get("msg"))
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        # data rows: [ts(ms), o, h, l, c, vol, ...] newest first.
        candles = [
            Candle(
                time=int(row[0]) // 1000,
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[5]),
            )
            for row in payload.get("data", [])
        ]
        candles.sort(key=lambda c: c.time)
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


okx_provider = OKXProvider()
