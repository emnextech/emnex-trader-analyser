"""Market data service: routes a clean symbol id to its provider."""
from __future__ import annotations

from collections.abc import AsyncIterator

from app.market.base import MarketDataProvider
from app.market.binance import binance_provider
from app.market.yahoo import yahoo_provider
from app.market import symbols as catalog
from app.schemas.market import Candle, Symbol, TIMEFRAMES

_PROVIDERS: dict[str, MarketDataProvider] = {
    "binance": binance_provider,
    "yahoo": yahoo_provider,
}


class SymbolNotFound(Exception):
    pass


def list_symbols() -> list[Symbol]:
    return catalog.CATALOG


def list_timeframes() -> list[str]:
    return TIMEFRAMES


def _resolve(symbol_id: str) -> tuple[MarketDataProvider, str]:
    meta = catalog.get_symbol(symbol_id)
    native = catalog.native_symbol(symbol_id)
    if meta is None or native is None:
        raise SymbolNotFound(symbol_id)
    provider = _PROVIDERS[meta.provider]
    return provider, native


async def get_candles(symbol_id: str, interval: str, limit: int = 500) -> list[Candle]:
    provider, native = _resolve(symbol_id)
    return await provider.get_candles(native, interval, limit)


def stream(symbol_id: str, interval: str) -> AsyncIterator[Candle]:
    provider, native = _resolve(symbol_id)
    return provider.stream(native, interval)
