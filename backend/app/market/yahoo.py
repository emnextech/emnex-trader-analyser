"""Yahoo Finance provider via yfinance (forex, gold, indices, stocks).

No API key required. yfinance is synchronous and scraping-based, so calls run in
a thread pool and results are cached (TTL) to stay friendly with Yahoo and avoid
IP blocks. "Live" updates come from polling the latest candle.
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator

import pandas as pd
import yfinance as yf

from app.market.base import MarketDataProvider
from app.schemas.market import Candle

logger = logging.getLogger(__name__)

# App timeframe -> (yfinance interval, yfinance period within Yahoo's limits).
# Periods chosen to be reliable across forex, futures and indices: Yahoo rejects
# long hourly ranges (730d) for forex/futures, and long daily ranges (5y) for
# some futures, returning empty. Yahoo has no native 4h; we resample from 1h.
_INTERVAL_MAP: dict[str, tuple[str, str]] = {
    "1m": ("1m", "7d"),
    "5m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "30m": ("30m", "60d"),
    "1h": ("60m", "60d"),
    "4h": ("60m", "60d"),    # resampled from 1h
    "1d": ("1d", "2y"),
    "1w": ("1wk", "5y"),
    "1M": ("1mo", "max"),
}

# Timeframes that must be resampled from a finer Yahoo interval -> pandas rule.
_RESAMPLE: dict[str, str] = {"4h": "4h"}

# Poll cadence (seconds) for the live stream, per timeframe. Conservative to
# respect Yahoo. Cache TTL below is aligned so polls hit cache between fetches.
_POLL_SECONDS = 15.0
_CACHE_TTL = 12.0


class _CacheEntry:
    __slots__ = ("candles", "ts")

    def __init__(self, candles: list[Candle], ts: float) -> None:
        self.candles = candles
        self.ts = ts


class YahooProvider(MarketDataProvider):
    name = "yahoo"

    def __init__(self) -> None:
        self._cache: dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _df_to_candles(df: pd.DataFrame) -> list[Candle]:
        if df is None or df.empty:
            return []
        # yfinance may return MultiIndex columns when given a single ticker too.
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna(subset=["Open", "High", "Low", "Close"])
        candles: list[Candle] = []
        for idx, row in df.iterrows():
            ts = idx.timestamp() if hasattr(idx, "timestamp") else pd.Timestamp(idx).timestamp()
            vol = row.get("Volume", 0.0)
            candles.append(
                Candle(
                    time=int(ts),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=float(vol) if pd.notna(vol) else 0.0,
                )
            )
        return candles

    @staticmethod
    def _resample(df: pd.DataFrame, rule: str) -> pd.DataFrame:
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        agg = {
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }
        cols = {k: v for k, v in agg.items() if k in df.columns}
        return df.resample(rule).agg(cols).dropna(subset=["Open", "High", "Low", "Close"])

    def _fetch_sync(self, native_symbol: str, interval: str) -> list[Candle]:
        yf_interval, period = _INTERVAL_MAP[interval]
        df = yf.download(
            tickers=native_symbol,
            interval=yf_interval,
            period=period,
            auto_adjust=False,
            progress=False,
            threads=False,
        )
        if interval in _RESAMPLE and df is not None and not df.empty:
            df = self._resample(df, _RESAMPLE[interval])
        return self._df_to_candles(df)

    async def get_candles(
        self, native_symbol: str, interval: str, limit: int = 500
    ) -> list[Candle]:
        if interval not in _INTERVAL_MAP:
            raise ValueError(f"Unsupported interval for Yahoo: {interval}")

        key = f"{native_symbol}:{interval}"
        now = time.monotonic()
        async with self._lock:
            entry = self._cache.get(key)
            if entry and (now - entry.ts) < _CACHE_TTL:
                return entry.candles[-limit:]

        try:
            candles = await asyncio.to_thread(self._fetch_sync, native_symbol, interval)
        except Exception:  # noqa: BLE001 — surface as empty, log for diagnosis
            logger.exception("Yahoo fetch failed for %s %s", native_symbol, interval)
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


yahoo_provider = YahooProvider()
