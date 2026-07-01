"""Curated symbol catalog: clean platform id -> provider + native symbol.

The API and frontend only ever use the clean `symbol` id (no `=X`, `^`, `/`),
keeping URLs and query params simple. This module is the single source of truth
for which provider serves a symbol and what its native string is.
"""
from __future__ import annotations

from app.schemas.market import Symbol

# Extra mapping of clean id -> provider-native symbol string.
_NATIVE: dict[str, str] = {
    "BTCUSDT": "BTCUSDT",
    "ETHUSDT": "ETHUSDT",
    "XAUUSD": "GC=F",       # Gold futures
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "NAS100": "^NDX",       # NASDAQ 100
    "SPX500": "^GSPC",      # S&P 500
    "US30": "^DJI",         # Dow Jones Industrial Average
}

CATALOG: list[Symbol] = [
    Symbol(symbol="BTCUSDT", name="Bitcoin", type="crypto", provider="binance"),
    Symbol(symbol="ETHUSDT", name="Ethereum", type="crypto", provider="binance"),
    Symbol(symbol="XAUUSD", name="Gold", type="commodity", provider="yahoo"),
    Symbol(symbol="EURUSD", name="EUR / USD", type="forex", provider="yahoo"),
    Symbol(symbol="GBPUSD", name="GBP / USD", type="forex", provider="yahoo"),
    Symbol(symbol="USDJPY", name="USD / JPY", type="forex", provider="yahoo"),
    Symbol(symbol="NAS100", name="NASDAQ 100", type="index", provider="yahoo"),
    Symbol(symbol="SPX500", name="S&P 500", type="index", provider="yahoo"),
    Symbol(symbol="US30", name="Dow Jones", type="index", provider="yahoo"),
]

_BY_ID: dict[str, Symbol] = {s.symbol: s for s in CATALOG}


def get_symbol(symbol_id: str) -> Symbol | None:
    return _BY_ID.get(symbol_id.upper())


def native_symbol(symbol_id: str) -> str | None:
    return _NATIVE.get(symbol_id.upper())
