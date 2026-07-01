"""Module 3 — Previous day/week high & low (PDH/PDL/PWH/PWL) key levels."""
from __future__ import annotations

import pandas as pd

from app.schemas.market import Candle
from app.schemas.analysis import KeyLevel


def compute_key_levels(candles: list[Candle]) -> list[KeyLevel]:
    """Previous completed day/week highs and lows — common liquidity references."""
    if len(candles) < 3:
        return []

    df = pd.DataFrame(
        {
            "high": [c.high for c in candles],
            "low": [c.low for c in candles],
        },
        index=pd.to_datetime([c.time for c in candles], unit="s", utc=True),
    )

    out: list[KeyLevel] = []
    for rule, hi_label, lo_label in (("D", "PDH", "PDL"), ("W", "PWH", "PWL")):
        agg = df.resample(rule).agg({"high": "max", "low": "min"}).dropna()
        if len(agg) >= 2:
            prev = agg.iloc[-2]  # last *completed* period
            out.append(KeyLevel(label=hi_label, price=round(float(prev["high"]), 8)))
            out.append(KeyLevel(label=lo_label, price=round(float(prev["low"]), 8)))
    return out
