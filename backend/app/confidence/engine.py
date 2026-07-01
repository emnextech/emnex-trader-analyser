"""Module 10 — Confidence Engine: weighted score across analysis factors."""
from __future__ import annotations

from app.schemas.analysis import DecisionScores

# Factor weights (sum = 100), per PROJECT_PLAN example.
WEIGHTS = {
    "trend": 20,
    "structure": 20,
    "momentum": 20,
    "pattern": 15,
    "risk": 15,
    "volume": 10,
}


def final_confidence(scores: DecisionScores) -> int:
    """Weighted average of the per-factor 0-100 scores."""
    total = (
        scores.trend * WEIGHTS["trend"]
        + scores.structure * WEIGHTS["structure"]
        + scores.momentum * WEIGHTS["momentum"]
        + scores.pattern * WEIGHTS["pattern"]
        + scores.risk * WEIGHTS["risk"]
        + scores.volume * WEIGHTS["volume"]
    )
    return round(total / sum(WEIGHTS.values()))
