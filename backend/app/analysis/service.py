"""Analysis service: orchestrates the Phase 2-5 engines over live candles."""
from __future__ import annotations

import time

from app.ai import mentor
from app.analysis.ta_indicators import rsi
from app.candlestick.patterns import detect_last_pattern, scan_patterns
from app.decision.engine import decide
from app.drawing.fibonacci import compute_fibonacci
from app.drawing.key_levels import compute_key_levels
from app.drawing.levels import detect_levels
from collections.abc import AsyncIterator

from app.market import service as market_service
from app.schemas.analysis import (
    ChatMessage,
    MentorResponse,
    ScanResponse,
    ScanRow,
    SignalResponse,
    StructureResponse,
)
from app.structure.engine import (
    detect_events,
    detect_liquidity,
    detect_phase,
    label_swings,
    trend_strength,
)
from app.supply_demand.smc_zones import detect_zones
from app.swing.detector import detect_swings
from app.trendline.detector import detect_trendlines


async def analyze_structure(symbol: str, interval: str, limit: int = 400) -> StructureResponse:
    """Phase 2 + 3: swings, levels, trendlines, BOS/CHoCH, trend, liquidity."""
    candles = await market_service.get_candles(symbol, interval, limit)

    swings = label_swings(detect_swings(candles))
    levels = detect_levels(candles, swings)
    trendlines = detect_trendlines(candles, swings)
    events, trend = detect_events(candles, swings)
    strength = trend_strength(swings, trend)
    liquidity = detect_liquidity(swings)
    phase = detect_phase(candles)
    zones = detect_zones(candles)
    fibonacci = compute_fibonacci(swings)
    key_levels = compute_key_levels(candles)
    patterns = scan_patterns(candles)

    return StructureResponse(
        symbol=symbol.upper(),
        interval=interval,
        trend=trend,  # type: ignore[arg-type]
        trend_strength=strength,
        phase=phase,  # type: ignore[arg-type]
        swings=swings,
        levels=levels,
        trendlines=trendlines,
        events=events,
        liquidity=liquidity,
        zones=zones,
        fibonacci=fibonacci,
        key_levels=key_levels,
        patterns=patterns,
    )


def compute_signal(
    symbol: str,
    interval: str,
    candles: list,
    account_balance: float = 10000.0,
    risk_pct: float = 1.0,
    include_zones: bool = True,
) -> SignalResponse:
    """Phase 4 decision on an in-memory candle list (no fetch).

    Shared by the live signal endpoint and the backtester so both see the exact
    same engine. `include_zones` can be turned off for speed in tight loops
    (zone detection is the heaviest step); the decision engine treats an empty
    zone list as "no confluence".
    """
    swings = label_swings(detect_swings(candles))
    levels = detect_levels(candles, swings)
    events, trend = detect_events(candles, swings)
    strength = trend_strength(swings, trend)
    closes = [c.close for c in candles]
    rsi_val = rsi(closes)
    pattern = detect_last_pattern(candles)
    zones = detect_zones(candles) if include_zones else []

    return decide(
        symbol=symbol,
        interval=interval,
        candles=candles,
        swings=swings,
        levels=levels,
        events=events,
        trend=trend,
        trend_str=strength,
        rsi=rsi_val,
        pattern=pattern,
        zones=zones,
        account_balance=account_balance,
        risk_pct=risk_pct,
    )


async def analyze_signal(
    symbol: str,
    interval: str,
    account_balance: float = 10000.0,
    risk_pct: float = 1.0,
    limit: int = 400,
) -> SignalResponse:
    """Phase 4: decision / confidence / risk for a symbol."""
    candles = await market_service.get_candles(symbol, interval, limit)
    return compute_signal(symbol, interval, candles, account_balance, risk_pct)


# --- Phase 5: AI Mentor (cached to limit paid API usage) ---

_MENTOR_TTL = 120.0  # seconds
_mentor_cache: dict[str, tuple[float, MentorResponse]] = {}


async def analyze_mentor(symbol: str, interval: str) -> MentorResponse:
    """Generate a natural-language explanation of the current analysis."""
    key = f"{symbol.upper()}:{interval}"

    if not mentor.is_configured():
        return MentorResponse(symbol=symbol.upper(), interval=interval, configured=False)

    now = time.monotonic()
    cached = _mentor_cache.get(key)
    if cached and (now - cached[0]) < _MENTOR_TTL:
        return cached[1]

    structure = await analyze_structure(symbol, interval)
    signal = await analyze_signal(symbol, interval)
    explanation = await mentor.generate_explanation(symbol, interval, structure, signal)

    result = MentorResponse(
        symbol=symbol.upper(),
        interval=interval,
        configured=True,
        explanation=explanation,
        decision=signal.decision,
        confidence=signal.confidence,
    )
    _mentor_cache[key] = (time.monotonic(), result)
    return result


# --- Module 14: Market Scanner (concurrent, cached) ---

import asyncio  # noqa: E402

_SCAN_TTL = 45.0
_scan_cache: dict[str, tuple[float, ScanResponse]] = {}


async def _scan_one(meta, interval: str) -> ScanRow | None:
    try:
        signal = await analyze_signal(meta.symbol, interval)
        candles = await market_service.get_candles(meta.symbol, interval, 2)
        price = candles[-1].close if candles else None
        return ScanRow(
            symbol=meta.symbol,
            name=meta.name,
            type=meta.type,
            price=price,
            decision=signal.decision,
            bias=signal.bias,
            confidence=signal.confidence,
            trend=signal.trend,
            risk_reward=signal.risk.risk_reward if signal.risk else None,
            rsi=signal.momentum_rsi,
        )
    except Exception:  # noqa: BLE001
        return None


async def scan_market(interval: str) -> ScanResponse:
    """Run the decision engine across every catalog symbol and rank the results."""
    now = time.monotonic()
    cached = _scan_cache.get(interval)
    if cached and (now - cached[0]) < _SCAN_TTL:
        return cached[1]

    symbols = market_service.list_symbols()
    results = await asyncio.gather(*[_scan_one(m, interval) for m in symbols])
    rows = [r for r in results if r is not None]

    # Actionable setups first, then by confidence.
    rows.sort(
        key=lambda r: (r.decision in ("BUY", "SELL"), r.confidence),
        reverse=True,
    )
    response = ScanResponse(interval=interval, rows=rows)
    _scan_cache[interval] = (time.monotonic(), response)
    return response


# --- Module 17: Backtesting (walk-forward, CPU-bound → offloaded to a thread) ---


async def analyze_backtest(
    symbol: str,
    interval: str,
    account_balance: float = 10000.0,
    risk_pct: float = 1.0,
    min_confidence: int = 65,
    limit: int = 600,
):
    """Fetch history and replay it through the decision engine."""
    from app.backtesting.engine import run_backtest  # lazy: avoids import cycle

    candles = await market_service.get_candles(symbol, interval, limit)
    if len(candles) < 150:
        raise ValueError(
            "Not enough history to backtest this symbol/timeframe. Try a lower timeframe."
        )
    # Offload the O(n) sweep so it never blocks the event loop.
    return await asyncio.to_thread(
        run_backtest,
        symbol,
        interval,
        candles,
        account_balance,
        risk_pct,
        min_confidence,
    )


async def mentor_chat_stream(
    symbol: str, interval: str, messages: list[ChatMessage]
) -> AsyncIterator[str]:
    """Stream a mentor chat reply grounded in the current analysis."""
    if not mentor.is_configured():
        yield "The AI mentor isn't configured. Add a free GROQ_API_KEY to backend/.env."
        return

    structure = await analyze_structure(symbol, interval)
    signal = await analyze_signal(symbol, interval)
    async for chunk in mentor.stream_chat(symbol, interval, structure, signal, messages):
        yield chunk
