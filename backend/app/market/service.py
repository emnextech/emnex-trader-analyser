"""Market data service: routes a clean symbol id to its provider."""
from __future__ import annotations

from collections.abc import AsyncIterator

from app.core.config import settings
from app.market.base import MarketDataProvider
from app.market.binance import binance_provider
from app.market.okx import okx_provider
from app.market.twelvedata import twelvedata_provider
from app.market.yahoo import yahoo_provider
from app.market import symbols as catalog
from app.schemas.market import Candle, Symbol, TIMEFRAMES

_PROVIDERS: dict[str, MarketDataProvider] = {
    "binance": binance_provider,
    "okx": okx_provider,
    "yahoo": yahoo_provider,
    "twelvedata": twelvedata_provider,
}


class SymbolNotFound(Exception):
    pass


def list_symbols() -> list[Symbol]:
    return catalog.CATALOG


def list_timeframes() -> list[str]:
    return TIMEFRAMES


def symbol_exists(symbol_id: str) -> bool:
    return (
        catalog.get_symbol(symbol_id) is not None
        and catalog.native_symbol(symbol_id) is not None
    )


def _resolve(symbol_id: str) -> tuple[MarketDataProvider, str]:
    meta = catalog.get_symbol(symbol_id)
    native = catalog.native_symbol(symbol_id)
    if meta is None or native is None:
        raise SymbolNotFound(symbol_id)

    # Prefer TwelveData for instruments it can serve (forex + gold) when a key
    # is configured; otherwise use the catalog's default provider (Yahoo).
    if settings.twelvedata_api_key:
        td_native = catalog.td_native_symbol(symbol_id)
        if td_native is not None:
            return _PROVIDERS["twelvedata"], td_native

    provider = _PROVIDERS[meta.provider]
    return provider, native


async def get_candles(symbol_id: str, interval: str, limit: int = 500) -> list[Candle]:
    provider, native = _resolve(symbol_id)
    candles = await provider.get_candles(native, interval, limit)

    # Resilience: if TwelveData (forex/gold) returns nothing (rate limit/quota),
    # fall back to keyless Yahoo so the chart never goes blank.
    if not candles and provider.name == "twelvedata":
        y_native = catalog.native_symbol(symbol_id)
        if y_native:
            candles = await yahoo_provider.get_candles(y_native, interval, limit)

    # Crypto: if Binance is rate-limited (429) or geo-blocked (451), use OKX.
    if not candles and provider.name == "binance":
        candles = await okx_provider.get_candles(native, interval, limit)

    return candles


async def stream(symbol_id: str, interval: str) -> AsyncIterator[Candle]:
    provider, native = _resolve(symbol_id)

    # Crypto: prefer Binance's real-time WebSocket, but if Binance is unhealthy
    # (rate-limit / geo-block) fall back to polling OKX.
    if provider.name == "binance":
        healthy = await binance_provider.get_candles(native, interval, limit=2)
        active = binance_provider if healthy else okx_provider
        async for candle in active.stream(native, interval):
            yield candle
        return

    async for candle in provider.stream(native, interval):
        yield candle
