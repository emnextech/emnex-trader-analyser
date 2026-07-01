"""Module 11 — Risk Manager: entry, stop, target, R:R and position size."""
from __future__ import annotations

from app.analysis.indicators import atr
from app.schemas.market import Candle
from app.schemas.analysis import Level, RiskPlan, SwingPoint


def build_plan(
    candles: list[Candle],
    swings: list[SwingPoint],
    levels: list[Level],
    direction: str,
    account_balance: float,
    risk_pct: float,
) -> RiskPlan | None:
    if not candles:
        return None

    entry = candles[-1].close
    atr_val = atr(candles) or (entry * 0.01)

    highs = [s.price for s in swings if s.kind == "high"]
    lows = [s.price for s in swings if s.kind == "low"]

    min_stop = 0.5 * atr_val  # avoid micro-stops when price sits on a swing
    max_rr = 5.0              # cap unrealistic reward:risk from far-off levels

    if direction == "long":
        below = [lo for lo in lows if lo < entry]
        stop = max(below) if below else entry - 1.5 * atr_val
        if entry - stop < min_stop:
            stop = entry - atr_val
        risk_per_unit = entry - stop
        above_levels = [lv.price for lv in levels if lv.price > entry]
        take = min(above_levels) if above_levels else entry + 2 * risk_per_unit
        take = min(take, entry + max_rr * risk_per_unit)
    else:
        above = [hi for hi in highs if hi > entry]
        stop = min(above) if above else entry + 1.5 * atr_val
        if stop - entry < min_stop:
            stop = entry + atr_val
        risk_per_unit = stop - entry
        below_levels = [lv.price for lv in levels if lv.price < entry]
        take = max(below_levels) if below_levels else entry - 2 * risk_per_unit
        take = max(take, entry - max_rr * risk_per_unit)

    reward = abs(take - entry)
    if risk_per_unit <= 0:
        return None

    rr = reward / risk_per_unit
    risk_amount = account_balance * (risk_pct / 100.0)
    position_size = risk_amount / risk_per_unit

    return RiskPlan(
        direction="long" if direction == "long" else "short",
        entry=round(entry, 8),
        stop_loss=round(stop, 8),
        take_profit=round(take, 8),
        risk_reward=round(rr, 2),
        risk_pct=risk_pct,
        account_balance=account_balance,
        position_size=round(position_size, 4),
    )
