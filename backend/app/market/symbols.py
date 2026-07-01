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
    "AUDUSD": "AUDUSD=X",
    "USDCAD": "USDCAD=X",
    "USDCHF": "USDCHF=X",
    "NZDUSD": "NZDUSD=X",
    "NAS100": "^NDX",       # NASDAQ 100
    "SPX500": "^GSPC",      # S&P 500
    "US30": "^DJI",         # Dow Jones Industrial Average
    # Stocks (Yahoo native ticker == clean id)
    "AAPL": "AAPL",
    "MSFT": "MSFT",
    "NVDA": "NVDA",
    "TSLA": "TSLA",
    "AMZN": "AMZN",
    "GOOGL": "GOOGL",
}

# TwelveData-native symbols (forex + gold). Used only when TWELVEDATA_API_KEY is
# configured; otherwise these symbols fall back to their Yahoo natives above.
_TD_NATIVE: dict[str, str] = {
    "XAUUSD": "XAU/USD",
    "EURUSD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY",
    "AUDUSD": "AUD/USD",
    "USDCAD": "USD/CAD",
    "USDCHF": "USD/CHF",
    "NZDUSD": "NZD/USD",
}

CATALOG: list[Symbol] = [
    Symbol(symbol="BTCUSDT", name="Bitcoin", type="crypto", provider="binance"),
    Symbol(symbol="ETHUSDT", name="Ethereum", type="crypto", provider="binance"),
    Symbol(symbol="XAUUSD", name="Gold", type="commodity", provider="yahoo"),
    Symbol(symbol="EURUSD", name="EUR / USD", type="forex", provider="yahoo"),
    Symbol(symbol="GBPUSD", name="GBP / USD", type="forex", provider="yahoo"),
    Symbol(symbol="USDJPY", name="USD / JPY", type="forex", provider="yahoo"),
    Symbol(symbol="AUDUSD", name="AUD / USD", type="forex", provider="yahoo"),
    Symbol(symbol="USDCAD", name="USD / CAD", type="forex", provider="yahoo"),
    Symbol(symbol="USDCHF", name="USD / CHF", type="forex", provider="yahoo"),
    Symbol(symbol="NZDUSD", name="NZD / USD", type="forex", provider="yahoo"),
    Symbol(symbol="NAS100", name="NASDAQ 100", type="index", provider="yahoo"),
    Symbol(symbol="SPX500", name="S&P 500", type="index", provider="yahoo"),
    Symbol(symbol="US30", name="Dow Jones", type="index", provider="yahoo"),
    Symbol(symbol="AAPL", name="Apple", type="stock", provider="yahoo"),
    Symbol(symbol="MSFT", name="Microsoft", type="stock", provider="yahoo"),
    Symbol(symbol="NVDA", name="NVIDIA", type="stock", provider="yahoo"),
    Symbol(symbol="TSLA", name="Tesla", type="stock", provider="yahoo"),
    Symbol(symbol="AMZN", name="Amazon", type="stock", provider="yahoo"),
    Symbol(symbol="GOOGL", name="Alphabet", type="stock", provider="yahoo"),
]

_BY_ID: dict[str, Symbol] = {s.symbol: s for s in CATALOG}


def get_symbol(symbol_id: str) -> Symbol | None:
    return _BY_ID.get(symbol_id.upper())


def native_symbol(symbol_id: str) -> str | None:
    return _NATIVE.get(symbol_id.upper())


def td_native_symbol(symbol_id: str) -> str | None:
    """TwelveData-native symbol, if this instrument can be served by TwelveData."""
    return _TD_NATIVE.get(symbol_id.upper())
