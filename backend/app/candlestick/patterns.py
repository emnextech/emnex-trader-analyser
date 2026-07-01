"""Module 5 — Candlestick pattern recognition.

`detect_at` recognises the pattern ending at a given index (single-, two-, and
three-candle patterns). `detect_last_pattern` feeds the Decision Engine; and
`scan_patterns` marks recent patterns across the series for the chart.
"""
from __future__ import annotations

from app.schemas.market import Candle
from app.schemas.analysis import CandleMark, CandlePattern


def _body(c: Candle) -> float:
    return abs(c.close - c.open)


def _rng(c: Candle) -> float:
    return max(c.high - c.low, 1e-9)


def detect_at(candles: list[Candle], i: int) -> tuple[str, str] | None:
    """Return (name, bias) for the pattern ending at index i, or None.

    bias ∈ {"bullish","bearish","neutral"}. Priority: 3-candle > engulfing >
    hammer/star > inside/outside > doji > strong body.
    """
    if i < 0 or i >= len(candles):
        return None
    c = candles[i]
    body = _body(c)
    rng = _rng(c)
    upper = c.high - max(c.open, c.close)
    lower = min(c.open, c.close) - c.low
    bull = c.close >= c.open

    # --- 3-candle patterns ---
    if i >= 2:
        a, b = candles[i - 2], candles[i - 1]
        a_bear = a.close < a.open
        a_bull = a.close > a.open
        if (
            a_bear and _body(a) > _rng(a) * 0.5
            and _body(b) <= _rng(b) * 0.4
            and bull and c.close > (a.open + a.close) / 2
        ):
            return ("Morning Star", "bullish")
        if (
            a_bull and _body(a) > _rng(a) * 0.5
            and _body(b) <= _rng(b) * 0.4
            and not bull and c.close < (a.open + a.close) / 2
        ):
            return ("Evening Star", "bearish")
        if (
            a.close > a.open and b.close > b.open and c.close > c.open
            and c.close > b.close > a.close
        ):
            return ("Three White Soldiers", "bullish")
        if (
            a.close < a.open and b.close < b.open and c.close < c.open
            and c.close < b.close < a.close
        ):
            return ("Three Black Crows", "bearish")

    # --- 2-candle patterns ---
    if i >= 1:
        b = candles[i - 1]
        b_bull = b.close >= b.open
        if bull and not b_bull and c.close >= b.open and c.open <= b.close:
            return ("Bullish Engulfing", "bullish")
        if not bull and b_bull and c.open >= b.close and c.close <= b.open:
            return ("Bearish Engulfing", "bearish")
        if c.high <= b.high and c.low >= b.low:
            return ("Inside Bar", "neutral")
        if c.high >= b.high and c.low <= b.low and body >= rng * 0.5:
            return ("Outside Bar", "bullish" if bull else "bearish")

    # --- single-candle patterns ---
    if body <= rng * 0.1:
        return ("Doji", "neutral")
    if lower >= body * 2 and upper <= body and body <= rng * 0.4:
        return ("Hammer", "bullish")
    if upper >= body * 2 and lower <= body and body <= rng * 0.4:
        return ("Shooting Star", "bearish")
    if body >= rng * 0.85:
        return ("Strong Bull Candle" if bull else "Strong Bear Candle",
                "bullish" if bull else "bearish")
    return None


def detect_last_pattern(candles: list[Candle]) -> CandlePattern | None:
    if len(candles) < 2:
        return None
    hit = detect_at(candles, len(candles) - 1)
    if hit is None:
        return None
    name, bias = hit
    return CandlePattern(name=name, bias=bias)  # type: ignore[arg-type]


def scan_patterns(candles: list[Candle], lookback: int = 60, limit: int = 20) -> list[CandleMark]:
    """Mark recognised patterns over the last `lookback` candles (most recent first-capped)."""
    n = len(candles)
    if n < 3:
        return []
    marks: list[CandleMark] = []
    for i in range(max(2, n - lookback), n):
        hit = detect_at(candles, i)
        if hit is None:
            continue
        name, bias = hit
        marks.append(CandleMark(time=candles[i].time, name=name, bias=bias))  # type: ignore[arg-type]
    return marks[-limit:]
