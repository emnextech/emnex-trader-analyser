"""Module 7 — Trendline Engine.

Fit straight trendlines through swing pivots: connect pairs of swing highs
(resistance) or swing lows (support), keep lines that are respected by price
(few violations) and touched by multiple pivots, score them, and extend the
best ones to the latest candle.
"""
from __future__ import annotations

from app.schemas.market import Candle
from app.schemas.analysis import LinePoint, SwingPoint, Trendline


def _build(
    pivots: list[SwingPoint],
    candles: list[Candle],
    kind: str,
    tolerance_pct: float,
    max_violation_ratio: float,
) -> list[Trendline]:
    if len(pivots) < 2:
        return []

    last = candles[-1]
    first_time = candles[0].time
    span = max(last.time - first_time, 1)
    results: list[Trendline] = []

    for i in range(len(pivots)):
        for j in range(i + 1, len(pivots)):
            a, b = pivots[i], pivots[j]
            dt = b.time - a.time
            if dt <= 0:
                continue
            slope = (b.price - a.price) / dt

            def line(t: int) -> float:
                return a.price + slope * (t - a.time)

            ref = max(abs(a.price), abs(b.price), 1e-9)
            tol = ref * tolerance_pct

            # Touches: pivots lying on the line; violations: candles piercing it.
            touches = sum(1 for p in pivots if abs(p.price - line(p.time)) <= tol)
            checked = 0
            violations = 0
            for c in candles:
                if c.time < a.time:
                    continue
                checked += 1
                y = line(c.time)
                if kind == "resistance" and c.high > y + tol:
                    violations += 1
                elif kind == "support" and c.low < y - tol:
                    violations += 1

            if touches < 2 or checked == 0:
                continue
            if violations / checked > max_violation_ratio:
                continue

            recency = (b.time - first_time) / span  # favour recent lines
            score = touches * 2.0 - violations * 0.5 + recency
            results.append(
                Trendline(
                    start=LinePoint(time=a.time, price=round(a.price, 8)),
                    end=LinePoint(time=last.time, price=round(line(last.time), 8)),
                    kind=kind,  # type: ignore[arg-type]
                    touches=touches,
                    score=round(score, 3),
                )
            )

    return results


def _dedupe(lines: list[Trendline], top: int) -> list[Trendline]:
    lines.sort(key=lambda t: t.score, reverse=True)
    kept: list[Trendline] = []
    for ln in lines:
        dup = False
        for k in kept:
            if (
                k.kind == ln.kind
                and abs(k.end.price - ln.end.price) <= abs(k.end.price) * 0.004
                and abs(k.start.time - ln.start.time) <= 1
            ):
                dup = True
                break
        if not dup:
            kept.append(ln)
        if len(kept) >= top:
            break
    return kept


def detect_trendlines(
    candles: list[Candle],
    swings: list[SwingPoint],
    tolerance_pct: float = 0.003,
    max_violation_ratio: float = 0.05,
    max_per_side: int = 2,
    recent_pivots: int = 15,
) -> list[Trendline]:
    if len(candles) < 3:
        return []

    highs = [s for s in swings if s.kind == "high"][-recent_pivots:]
    lows = [s for s in swings if s.kind == "low"][-recent_pivots:]

    resistance = _build(highs, candles, "resistance", tolerance_pct, max_violation_ratio)
    support = _build(lows, candles, "support", tolerance_pct, max_violation_ratio)

    return _dedupe(resistance, max_per_side) + _dedupe(support, max_per_side)
