"""Pydantic models for market data shared across the API."""
from __future__ import annotations

from pydantic import BaseModel, Field

# Application-level timeframes exposed to the frontend.
TIMEFRAMES: list[str] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1M"]


class Candle(BaseModel):
    """A single OHLCV candle.

    `time` is UNIX epoch *seconds* (UTC) to match TradingView Lightweight Charts.
    """

    time: int = Field(..., description="UNIX epoch seconds (UTC), candle open time")
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0


class Symbol(BaseModel):
    """A tradable instrument exposed by the platform."""

    symbol: str = Field(..., description="Clean platform symbol id, e.g. BTCUSDT, EURUSD")
    name: str = Field(..., description="Human-readable name, e.g. Bitcoin")
    type: str = Field(..., description="Market type: crypto | forex | commodity | index | stock")
    provider: str = Field(..., description="Data provider: binance | yahoo")


class CandlesResponse(BaseModel):
    symbol: str
    interval: str
    candles: list[Candle]
