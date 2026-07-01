"""Pydantic models for the analysis / drawing engine (Phase 2)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SwingPoint(BaseModel):
    time: int = Field(..., description="UNIX epoch seconds of the pivot candle")
    price: float
    kind: Literal["high", "low"]
    strength: Literal["major", "minor"] = "minor"
    label: Literal["HH", "HL", "LH", "LL"] | None = None


class Level(BaseModel):
    """A horizontal support/resistance level clustered from swing points."""

    price: float
    kind: Literal["support", "resistance"]
    touches: int = Field(..., description="Number of swing points that formed this level")
    first_time: int
    last_time: int


class LinePoint(BaseModel):
    time: int
    price: float


class Trendline(BaseModel):
    start: LinePoint
    end: LinePoint
    kind: Literal["support", "resistance"]
    touches: int
    score: float = Field(..., description="Higher = stronger (more touches, better fit)")


class StructureEvent(BaseModel):
    """A Break of Structure (BOS) or Change of Character (CHoCH)."""

    type: Literal["BOS", "CHoCH"]
    direction: Literal["bullish", "bearish"]
    price: float = Field(..., description="The broken swing level")
    from_time: int = Field(..., description="Time of the swing that was broken")
    time: int = Field(..., description="Time of the candle that broke it")


class Liquidity(BaseModel):
    """A liquidity pool from equal highs/lows."""

    price: float
    side: Literal["buy", "sell"]  # buy-side rests above price, sell-side below
    touches: int


class Zone(BaseModel):
    """A supply/demand zone: Order Block or Fair Value Gap (from SMC)."""

    kind: Literal["order_block", "fvg"]
    direction: Literal["bullish", "bearish"]
    top: float
    bottom: float
    start_time: int
    end_time: int
    mitigated: bool = False
    fresh: bool = True
    tests: int = 0
    strength: int = 50
    label: str = ""


Trend = Literal["bullish", "bearish", "ranging"]
Phase = Literal["compression", "expansion", "normal"]


class FibLevel(BaseModel):
    ratio: float
    price: float


class Fibonacci(BaseModel):
    high: float
    low: float
    direction: Literal["up", "down"]
    start_time: int
    end_time: int
    levels: list[FibLevel]


class KeyLevel(BaseModel):
    label: str  # PDH, PDL, PWH, PWL
    price: float


class CandleMark(BaseModel):
    time: int
    name: str
    bias: Literal["bullish", "bearish", "neutral"]


class StructureResponse(BaseModel):
    symbol: str
    interval: str
    trend: Trend
    trend_strength: int = Field(..., ge=0, le=100)
    phase: Phase
    swings: list[SwingPoint]
    levels: list[Level]
    trendlines: list[Trendline]
    events: list[StructureEvent]
    liquidity: list[Liquidity]
    zones: list[Zone]
    fibonacci: Fibonacci | None = None
    key_levels: list[KeyLevel] = []
    patterns: list[CandleMark] = []


# --- Phase 4: Decision / Confidence / Risk ---------------------------------


class CandlePattern(BaseModel):
    name: str
    bias: Literal["bullish", "bearish", "neutral"]


class DecisionScores(BaseModel):
    trend: int
    structure: int
    momentum: int
    pattern: int
    risk: int
    volume: int


class RiskPlan(BaseModel):
    direction: Literal["long", "short"]
    entry: float
    stop_loss: float
    take_profit: float
    risk_reward: float
    risk_pct: float
    account_balance: float
    position_size: float = Field(..., description="Units sized to risk_pct of balance")


class SignalResponse(BaseModel):
    symbol: str
    interval: str
    decision: Literal["BUY", "SELL", "WAIT", "NO_TRADE"]
    bias: Trend
    confidence: int = Field(..., ge=0, le=100)
    trend: Trend
    momentum_rsi: float | None
    scores: DecisionScores
    pattern: CandlePattern | None
    risk: RiskPlan | None
    reasons: list[str]


# --- Phase 5: AI Mentor ---


class MentorResponse(BaseModel):
    symbol: str
    interval: str
    configured: bool = Field(..., description="Whether the AI mentor is enabled (API key set)")
    explanation: str = ""
    decision: str | None = None
    confidence: int | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class MentorChatRequest(BaseModel):
    symbol: str
    interval: str
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=20)


# --- Module 14: Market Scanner ---


class ScanRow(BaseModel):
    symbol: str
    name: str
    type: str
    price: float | None = None
    decision: Literal["BUY", "SELL", "WAIT", "NO_TRADE"]
    bias: Trend
    confidence: int
    trend: Trend
    risk_reward: float | None = None
    rsi: float | None = None


class ScanResponse(BaseModel):
    interval: str
    rows: list[ScanRow]


# --- Module 15: Notifications ---


class AlertRequest(BaseModel):
    title: str = Field(..., max_length=120)
    message: str = Field(..., max_length=1000)


class NotifyStatus(BaseModel):
    discord: bool
    telegram: bool


class AlertResult(BaseModel):
    sent: list[str]


# --- Module 17: Backtesting ---


class BacktestTrade(BaseModel):
    """A single simulated trade produced by the walk-forward backtest."""

    entry_time: int
    exit_time: int
    direction: Literal["long", "short"]
    entry: float
    stop_loss: float
    take_profit: float
    exit_price: float
    outcome: Literal["win", "loss", "timeout"]
    r_multiple: float = Field(..., description="Result in R (reward:risk) units")
    pnl: float = Field(..., description="Profit/loss in account currency")
    confidence: int


class EquityPoint(BaseModel):
    time: int
    balance: float


class BacktestStats(BaseModel):
    total_trades: int
    wins: int
    losses: int
    win_rate: float = Field(..., description="Winners / total (%)")
    profit_factor: float | None = Field(None, description="Gross profit / gross loss")
    expectancy_r: float = Field(..., description="Average R per trade")
    avg_win_r: float
    avg_loss_r: float
    avg_rr: float = Field(..., description="Average planned reward:risk")
    total_return_pct: float
    final_balance: float
    max_drawdown_pct: float


class BacktestResponse(BaseModel):
    symbol: str
    interval: str
    account_balance: float
    risk_pct: float
    min_confidence: int
    candles_tested: int
    stats: BacktestStats
    trades: list[BacktestTrade]
    equity_curve: list[EquityPoint]
