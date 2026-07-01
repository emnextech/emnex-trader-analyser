"""Indicators backed by the `ta` library (pandas-based, no TA-Lib build)."""
from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator


def rsi(closes: list[float], period: int = 14) -> float | None:
    """Latest RSI value using the `ta` library."""
    if len(closes) < period + 1:
        return None
    series = pd.Series(closes, dtype="float64")
    values = RSIIndicator(close=series, window=period).rsi()
    last = values.iloc[-1]
    return round(float(last), 2) if pd.notna(last) else None
