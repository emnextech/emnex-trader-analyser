"""Module 4 — Market Structure Engine.

Builds on detected swings to label HH/HL/LH/LL, detect Break of Structure (BOS)
and Change of Character (CHoCH), determine market trend & strength, locate
liquidity pools (equal highs/lows), and classify the volatility phase.
"""
from __future__ import annotations

from app.analysis.indicators import atr
from app.schemas.market import Candle
from app.schemas.analysis import Liquidity, StructureEvent, SwingPoint


def label_swings(swings: list[SwingPoint]) -> list[SwingPoint]:
    """Tag each swing as HH/HL/LH/LL relative to the previous same-kind swing."""
    last_high: float | None = None
    last_low: float | None = None
    for s in swings:
        if s.kind == "high":
            if last_high is not None:
                s.label = "HH" if s.price > last_high else "LH"
            last_high = s.price
        else:
            if last_low is not None:
                s.label = "HL" if s.price > last_low else "LL"
            last_low = s.price
    return swings


def detect_events(
    candles: list[Candle], swings: list[SwingPoint]
) -> tuple[list[StructureEvent], str]:
    """Detect BOS / CHoCH by candle closes breaking prior swing levels.

    Returns (events, final_trend). Uses major swings as the external structure.
    """
    highs = [s for s in swings if s.kind == "high" and s.strength == "major"]
    lows = [s for s in swings if s.kind == "low" and s.strength == "major"]
    if not highs and not lows:
        highs = [s for s in swings if s.kind == "high"]
        lows = [s for s in swings if s.kind == "low"]

    events: list[StructureEvent] = []
    trend = "ranging"
    hi_i = -1
    lo_i = -1
    broken_hi: set[int] = set()
    broken_lo: set[int] = set()

    for c in candles:
        while hi_i + 1 < len(highs) and highs[hi_i + 1].time < c.time:
            hi_i += 1
        while lo_i + 1 < len(lows) and lows[lo_i + 1].time < c.time:
            lo_i += 1

        if hi_i >= 0:
            ref = highs[hi_i]
            if ref.time not in broken_hi and c.close > ref.price:
                events.append(
                    StructureEvent(
                        type="BOS" if trend == "bullish" else "CHoCH",
                        direction="bullish",
                        price=ref.price,
                        from_time=ref.time,
                        time=c.time,
                    )
                )
                broken_hi.add(ref.time)
                trend = "bullish"

        if lo_i >= 0:
            ref = lows[lo_i]
            if ref.time not in broken_lo and c.close < ref.price:
                events.append(
                    StructureEvent(
                        type="BOS" if trend == "bearish" else "CHoCH",
                        direction="bearish",
                        price=ref.price,
                        from_time=ref.time,
                        time=c.time,
                    )
                )
                broken_lo.add(ref.time)
                trend = "bearish"

    return events, trend


def trend_strength(swings: list[SwingPoint], trend: str, lookback: int = 6) -> int:
    """Fraction of recent labelled swings consistent with the trend (0-100)."""
    labelled = [s for s in swings if s.label][-lookback:]
    if not labelled or trend == "ranging":
        return 0 if trend == "ranging" else 50
    want = {"HH", "HL"} if trend == "bullish" else {"LH", "LL"}
    hits = sum(1 for s in labelled if s.label in want)
    return round(hits / len(labelled) * 100)


def detect_liquidity(
    swings: list[SwingPoint], tolerance_pct: float = 0.0015, min_touches: int = 2
) -> list[Liquidity]:
    """Equal highs (buy-side) / equal lows (sell-side) liquidity pools."""

    def cluster(points: list[SwingPoint], side: str) -> list[Liquidity]:
        out: list[Liquidity] = []
        ordered = sorted(points, key=lambda s: s.price)
        group: list[SwingPoint] = []
        for sp in ordered:
            if group and abs(sp.price - group[0].price) <= group[0].price * tolerance_pct:
                group.append(sp)
            else:
                if len(group) >= min_touches:
                    price = sum(g.price for g in group) / len(group)
                    out.append(Liquidity(price=round(price, 8), side=side, touches=len(group)))  # type: ignore[arg-type]
                group = [sp]
        if len(group) >= min_touches:
            price = sum(g.price for g in group) / len(group)
            out.append(Liquidity(price=round(price, 8), side=side, touches=len(group)))  # type: ignore[arg-type]
        return out

    highs = [s for s in swings if s.kind == "high"]
    lows = [s for s in swings if s.kind == "low"]
    return cluster(highs, "buy") + cluster(lows, "sell")


def detect_phase(candles: list[Candle], period: int = 14) -> str:
    """Compression / expansion via recent ATR vs prior ATR."""
    if len(candles) < period * 2 + 1:
        return "normal"
    recent = atr(candles[-(period + 1):], period)
    prior = atr(candles[-(2 * period + 1):-period], period)
    if not recent or not prior:
        return "normal"
    ratio = recent / prior
    if ratio < 0.8:
        return "compression"
    if ratio > 1.25:
        return "expansion"
    return "normal"
