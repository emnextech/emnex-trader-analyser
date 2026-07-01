"""Module 9 — Decision Engine.

Combines trend (structure), momentum, structure events, candlestick pattern,
risk/reward and volume into a transparent BUY / SELL / WAIT / NO_TRADE call with
a confidence score, a risk plan, and human-readable reasons for every decision.
"""
from __future__ import annotations

from app.confidence.engine import final_confidence
from app.risk.manager import build_plan
from app.schemas.market import Candle
from app.schemas.analysis import (
    CandlePattern,
    DecisionScores,
    Level,
    SignalResponse,
    StructureEvent,
    SwingPoint,
    Zone,
)


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> int:
    return int(max(lo, min(hi, v)))


def _bias(trend: str, rsi: float | None, last_event: StructureEvent | None,
          pattern: CandlePattern | None) -> str:
    score = 0
    if trend == "bullish":
        score += 1
    elif trend == "bearish":
        score -= 1
    if rsi is not None:
        if rsi > 55:
            score += 1
        elif rsi < 45:
            score -= 1
    if last_event:
        score += 1 if last_event.direction == "bullish" else -1
    if pattern:
        if pattern.bias == "bullish":
            score += 1
        elif pattern.bias == "bearish":
            score -= 1
    if score >= 1:
        return "bullish"
    if score <= -1:
        return "bearish"
    return "ranging"


def decide(
    symbol: str,
    interval: str,
    candles: list[Candle],
    swings: list[SwingPoint],
    levels: list[Level],
    events: list[StructureEvent],
    trend: str,
    trend_str: int,
    rsi: float | None,
    pattern: CandlePattern | None,
    zones: list[Zone],
    account_balance: float,
    risk_pct: float,
) -> SignalResponse:
    last_event = events[-1] if events else None
    bias = _bias(trend, rsi, last_event, pattern)
    reasons: list[str] = []

    # --- Per-factor scores (aligned to bias) -------------------------------
    if bias == "ranging":
        trend_score = 40
    elif trend == bias:
        trend_score = max(trend_str, 55)
        reasons.append(f"Market structure is {trend} (strength {trend_str}%).")
    elif trend == "ranging":
        trend_score = 45
        reasons.append("Market structure is ranging — no clear trend.")
    else:
        trend_score = 25
        reasons.append(f"Trend ({trend}) conflicts with the setup bias.")

    if last_event and bias != "ranging" and last_event.direction == bias:
        structure_score = 90 if last_event.type == "BOS" else 72
        reasons.append(
            f"{last_event.type} to the {last_event.direction} confirms structure."
        )
    elif last_event and bias != "ranging":
        structure_score = 28
        reasons.append(f"Last {last_event.type} was against the bias.")
    else:
        structure_score = 50

    # Zone confluence — price tapping a fresh aligned Order Block / FVG.
    price = candles[-1].close if candles else 0.0
    aligned = [
        z
        for z in zones
        if z.bottom <= price <= z.top and z.direction == bias and bias != "ranging"
    ]
    if aligned:
        z = aligned[0]
        structure_score = max(structure_score, 85)
        label = "order block" if z.kind == "order_block" else "fair value gap"
        reasons.append(f"Price is inside a fresh {z.direction} {label} — strong confluence.")

    if rsi is None:
        momentum_score = 50
    elif bias == "bullish":
        momentum_score = _clamp(50 + (rsi - 50) * 2)
        reasons.append(f"RSI {rsi} {'supports' if rsi > 50 else 'weak for'} a long.")
    elif bias == "bearish":
        momentum_score = _clamp(50 + (50 - rsi) * 2)
        reasons.append(f"RSI {rsi} {'supports' if rsi < 50 else 'weak for'} a short.")
    else:
        momentum_score = 50

    if pattern and bias != "ranging" and pattern.bias == bias:
        pattern_score = 85
        reasons.append(f"{pattern.name} candle supports the bias.")
    elif pattern and pattern.bias != "neutral" and bias != "ranging":
        pattern_score = 22
        reasons.append(f"{pattern.name} candle is against the bias.")
    else:
        pattern_score = 50

    # Volume (often unavailable for forex/indices → neutral).
    vols = [c.volume for c in candles[-20:]]
    if sum(vols) <= 0:
        volume_score = 50
    else:
        avg = sum(vols) / len(vols)
        last_v = candles[-1].volume
        volume_score = 70 if last_v > avg * 1.2 else 50

    # --- Risk plan ---------------------------------------------------------
    risk = None
    risk_score = 40
    if bias != "ranging":
        direction = "long" if bias == "bullish" else "short"
        risk = build_plan(candles, swings, levels, direction, account_balance, risk_pct)
        if risk:
            rr = risk.risk_reward
            risk_score = _clamp(25 + rr * 25)  # rr 1 -> 50, 2 -> 75, 3 -> 100
            reasons.append(
                f"Risk plan R:R {rr} (entry {risk.entry}, SL {risk.stop_loss}, "
                f"TP {risk.take_profit})."
            )

    scores = DecisionScores(
        trend=trend_score,
        structure=structure_score,
        momentum=momentum_score,
        pattern=pattern_score,
        risk=risk_score,
        volume=volume_score,
    )
    confidence = final_confidence(scores)

    # --- Decision ----------------------------------------------------------
    if bias == "ranging":
        decision = "WAIT"
        reasons.insert(0, "Conflicting signals — stand aside until structure is clear.")
    elif confidence >= 65:
        decision = "BUY" if bias == "bullish" else "SELL"
    elif confidence >= 50:
        decision = "WAIT"
        reasons.insert(0, "Setup forming but confidence is moderate — wait for confirmation.")
    else:
        decision = "NO_TRADE"
        reasons.insert(0, "Low-quality setup — no trade.")

    return SignalResponse(
        symbol=symbol.upper(),
        interval=interval,
        decision=decision,  # type: ignore[arg-type]
        bias=bias,  # type: ignore[arg-type]
        confidence=confidence,
        trend=trend,  # type: ignore[arg-type]
        momentum_rsi=rsi,
        scores=scores,
        pattern=pattern,
        risk=risk,
        reasons=reasons,
    )
