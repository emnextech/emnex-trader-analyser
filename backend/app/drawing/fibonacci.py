"""Module 3 — Fibonacci retracement from the most recent swing leg."""
from __future__ import annotations

from app.schemas.analysis import Fibonacci, FibLevel, SwingPoint

_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]


def compute_fibonacci(swings: list[SwingPoint]) -> Fibonacci | None:
    """Draw fib levels across the latest swing high↔low leg."""
    highs = [s for s in swings if s.kind == "high"]
    lows = [s for s in swings if s.kind == "low"]
    if not highs or not lows:
        return None

    last_high = highs[-1]
    last_low = lows[-1]
    hi, lo = last_high.price, last_low.price
    if hi <= lo:
        return None

    # Direction of the most recent leg: up if the high formed after the low.
    if last_high.time >= last_low.time:
        direction = "up"
        start_time, end_time = last_low.time, last_high.time
    else:
        direction = "down"
        start_time, end_time = last_high.time, last_low.time

    diff = hi - lo
    # For an up leg, retracements pull down from the high; mirror for a down leg.
    levels = [
        FibLevel(
            ratio=r,
            price=round(hi - diff * r if direction == "up" else lo + diff * r, 8),
        )
        for r in _RATIOS
    ]
    return Fibonacci(
        high=round(hi, 8),
        low=round(lo, 8),
        direction=direction,  # type: ignore[arg-type]
        start_time=start_time,
        end_time=end_time,
        levels=levels,
    )
