"""Binance public market data provider (crypto).

REST klines for history + real-time WebSocket kline stream. No API key needed.
Docs: https://developers.binance.com/docs/binance-spot-api-docs
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx
import websockets

from app.market.base import MarketDataProvider
from app.schemas.market import Candle

logger = logging.getLogger(__name__)

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


class BinanceProvider(MarketDataProvider):
    name = "binance"

    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        params = {
            "symbol": native_symbol.upper(),
            "interval": _to_binance_interval(interval),
            "limit": min(max(limit, 1), 1000),
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_REST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
        return [_kline_to_candle(k) for k in data]

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
