"""Binance public market data provider (crypto).

REST klines for history + real-time WebSocket kline stream. No API key needed.
Docs: https://developers.binance.com/docs/binance-spot-api-docs
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator

import httpx
import websockets

from app.market.base import MarketDataProvider
from app.schemas.market import Candle

logger = logging.getLogger(__name__)

_CACHE_TTL = 10.0  # seconds

_REST_URL = "https://api.binance.com/api/v3/klines"
_WS_BASE = "wss://stream.binance.com:9443/ws"

# App timeframe -> Binance interval. Binance natively supports all of these.
_INTERVAL_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
    "1w": "1w",
    "1M": "1M",
}


def _to_binance_interval(interval: str) -> str:
    if interval not in _INTERVAL_MAP:
        raise ValueError(f"Unsupported interval for Binance: {interval}")
    return _INTERVAL_MAP[interval]


def _kline_to_candle(k: list) -> Candle:
    # [openTime(ms), open, high, low, close, volume, closeTime, ...]
    return Candle(
        time=int(k[0]) // 1000,
        open=float(k[1]),
        high=float(k[2]),
        low=float(k[3]),
        close=float(k[4]),
        volume=float(k[5]),
    )


class _CacheEntry:
    __slots__ = ("candles", "ts")

    def __init__(self, candles: list[Candle], ts: float) -> None:
        self.candles = candles
        self.ts = ts


class BinanceProvider(MarketDataProvider):
    name = "binance"

    # One fetch per symbol+interval shared by all callers to avoid rate limits.
    _OUTPUTSIZE = 500

    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()

    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        key = f"{native_symbol.upper()}:{interval}"
        now = time.monotonic()
        async with self._lock:
            entry = self._cache.get(key)
            if entry and (now - entry.ts) < _CACHE_TTL:
                return entry.candles[-limit:]

        params = {
            "symbol": native_symbol.upper(),
            "interval": _to_binance_interval(interval),
            "limit": self._OUTPUTSIZE,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(_REST_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception:  # noqa: BLE001 — rate limit (429), geo-block (451), network
            logger.warning("Binance fetch failed for %s %s", native_symbol, interval)
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        candles = [_kline_to_candle(k) for k in data]
        if not candles:
            entry = self._cache.get(key)
            return entry.candles[-limit:] if entry else []

        async with self._lock:
            self._cache[key] = _CacheEntry(candles, time.monotonic())
        return candles[-limit:]

    async def stream(  # type: ignore[override]
        self, native_symbol: str, interval: str
    ) -> AsyncIterator[Candle]:
        stream_name = f"{native_symbol.lower()}@kline_{_to_binance_interval(interval)}"
        url = f"{_WS_BASE}/{stream_name}"
        async for ws in websockets.connect(url, ping_interval=20, ping_timeout=20):
            try:
                async for message in ws:
                    payload = json.loads(message)
                    k = payload.get("k")
                    if not k:
                        continue
                    yield Candle(
                        time=int(k["t"]) // 1000,
                        open=float(k["o"]),
                        high=float(k["h"]),
                        low=float(k["l"]),
                        close=float(k["c"]),
                        volume=float(k["v"]),
                    )
            except websockets.ConnectionClosed:
                logger.warning("Binance WS closed for %s, reconnecting", stream_name)
                continue


binance_provider = BinanceProvider()
