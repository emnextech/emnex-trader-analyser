"""Module 3 (partial) — horizontal Support/Resistance levels.

Swing points whose prices fall within a tolerance band are clustered into a
single level. A level's strength is how many swings formed it; more touches =
stronger. Levels above the current price are resistance, below are support.
"""
from __future__ import annotations

from app.schemas.market import Candle
from app.schemas.analysis import Level, SwingPoint


def detect_levels(
    candles: list[Candle],
    swings: list[SwingPoint],
    tolerance_pct: float = 0.0035,
    min_touches: int = 2,
    max_levels: int = 8,
) -> list[Level]:
    """Cluster swing prices into horizontal S/R levels.

    `tolerance_pct` is the relative band (e.g. 0.0035 = 0.35%) within which
    swing prices are considered the same level.
    """
    if not candles or not swings:
        return []

    last_price = candles[-1].close
    # Sort swings by price so nearby prices cluster together.
    ordered = sorted(swings, key=lambda s: s.price)

    clusters: list[list[SwingPoint]] = []
    for sp in ordered:
        if clusters:
            ref = clusters[-1][0].price
            if abs(sp.price - ref) <= ref * tolerance_pct:
                clusters[-1].append(sp)
                continue
        clusters.append([sp])

    levels: list[Level] = []
    for cluster in clusters:
        if len(cluster) < min_touches:
            continue
        price = sum(s.price for s in cluster) / len(cluster)
        times = [s.time for s in cluster]
        levels.append(
            Level(
                price=round(price, 8),
                kind="resistance" if price >= last_price else "support",
                touches=len(cluster),
                first_time=min(times),
                last_time=max(times),
            )
        )

    # Keep the strongest, then the most recent.
    levels.sort(key=lambda lv: (lv.touches, lv.last_time), reverse=True)
    return levels[:max_levels]
