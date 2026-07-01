"""Module 8 — Swing Engine: detect swing/pivot highs and lows.

A fractal pivot: a candle whose high is strictly greater than the highs of
`left` candles before and `right` candles after is a swing high (mirror for
lows). "Major" swings use a wider window than "minor" ones.
"""
from __future__ import annotations

from app.schemas.market import Candle
from app.schemas.analysis import SwingPoint


def _pivots(candles: list[Candle], left: int, right: int) -> tuple[set[int], set[int]]:
    """Return (high_indices, low_indices) of pivots for the given window."""
    highs: set[int] = set()
    lows: set[int] = set()
    n = len(candles)
    for i in range(left, n - right):
        hi = candles[i].high
        lo = candles[i].low
        is_high = True
        is_low = True
        for j in range(i - left, i + right + 1):
            if j == i:
                continue
            if candles[j].high >= hi:
                is_high = False
            if candles[j].low <= lo:
                is_low = False
            if not is_high and not is_low:
                break
        if is_high:
            highs.add(i)
        if is_low:
            lows.add(i)
    return highs, lows


def detect_swings(
    candles: list[Candle],
    left: int = 2,
    right: int = 2,
    major_window: int = 5,
) -> list[SwingPoint]:
    """Detect swing points, tagging those that are also pivots at a wider
    window as 'major'."""
    if len(candles) < (left + right + 1):
        return []

    minor_highs, minor_lows = _pivots(candles, left, right)
    major_highs, major_lows = _pivots(candles, major_window, major_window)

    swings: list[SwingPoint] = []
    for i in sorted(minor_highs):
        swings.append(
            SwingPoint(
                time=candles[i].time,
                price=candles[i].high,
                kind="high",
                strength="major" if i in major_highs else "minor",
            )
        )
    for i in sorted(minor_lows):
        swings.append(
            SwingPoint(
                time=candles[i].time,
                price=candles[i].low,
                kind="low",
                strength="major" if i in major_lows else "minor",
            )
        )

    swings.sort(key=lambda s: s.time)
    return swings
