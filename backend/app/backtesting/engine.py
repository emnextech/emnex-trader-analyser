"""Module 17 — Backtesting engine.

Walk-forward simulation: step through historical candles one bar at a time,
feed only the candles known *at that point* into the very same decision engine
the live app uses, and when it produces a BUY/SELL, simulate the trade forward
bar-by-bar to see whether the stop or target is hit first.

Design choices that keep the results honest:
- **No lookahead.** At bar ``i`` the engine only sees ``candles[:i+1]``.
- **Pessimistic fills.** If a single bar's range spans both the stop and the
  target, we assume the stop was hit first (worst case).
- **No overlapping trades.** A new setup is only taken when flat, so results
  reflect a single-position account.
- **Compounding.** Each trade risks ``risk_pct`` of the *current* equity.
"""
from __future__ import annotations

from app.analysis.service import compute_signal
from app.schemas.market import Candle
from app.schemas.analysis import (
    BacktestResponse,
    BacktestStats,
    BacktestTrade,
    EquityPoint,
)


def _simulate_exit(
    candles: list[Candle],
    start_idx: int,
    direction: str,
    stop: float,
    take: float,
    max_hold: int,
) -> tuple[float, str, int]:
    """Walk forward from the bar after entry until stop/target/timeout.

    Returns (exit_price, outcome, exit_index).
    """
    end = min(len(candles), start_idx + 1 + max_hold)
    for j in range(start_idx + 1, end):
        c = candles[j]
        if direction == "long":
            hit_stop = c.low <= stop
            hit_take = c.high >= take
        else:
            hit_stop = c.high >= stop
            hit_take = c.low <= take
        # Pessimistic: a bar that touches both is counted as a loss.
        if hit_stop:
            return stop, "loss", j
        if hit_take:
            return take, "win", j
    # Never resolved within the holding window → mark to market at the last bar.
    last_idx = end - 1
    return candles[last_idx].close, "timeout", last_idx


def run_backtest(
    symbol: str,
    interval: str,
    candles: list[Candle],
    account_balance: float,
    risk_pct: float,
    min_confidence: int,
    *,
    lookback: int = 250,
    warmup: int = 120,
    max_hold: int = 100,
) -> BacktestResponse:
    n = len(candles)
    equity = account_balance
    peak = equity
    max_dd = 0.0

    trades: list[BacktestTrade] = []
    rr_planned: list[float] = []
    equity_curve: list[EquityPoint] = [
        EquityPoint(time=candles[min(warmup, n - 1)].time, balance=round(equity, 2))
    ]

    i = warmup
    while i < n - 1:
        window = candles[max(0, i - lookback + 1) : i + 1]
        # Zones excluded here for speed (the heaviest detector); the core
        # trend/structure/momentum/pattern/risk engine still drives entries.
        sig = compute_signal(
            symbol, interval, window, equity, risk_pct, include_zones=False
        )

        if (
            sig.decision in ("BUY", "SELL")
            and sig.confidence >= min_confidence
            and sig.risk is not None
        ):
            plan = sig.risk
            entry = plan.entry
            stop = plan.stop_loss
            take = plan.take_profit
            risk_per_unit = abs(entry - stop)
            if risk_per_unit <= 0:
                i += 1
                continue

            exit_price, outcome, exit_idx = _simulate_exit(
                candles, i, plan.direction, stop, take, max_hold
            )

            if plan.direction == "long":
                r = (exit_price - entry) / risk_per_unit
            else:
                r = (entry - exit_price) / risk_per_unit

            risk_amount = equity * (risk_pct / 100.0)
            pnl = risk_amount * r
            equity += pnl
            peak = max(peak, equity)
            if peak > 0:
                max_dd = max(max_dd, (peak - equity) / peak * 100.0)

            rr_planned.append(plan.risk_reward)
            trades.append(
                BacktestTrade(
                    entry_time=candles[i].time,
                    exit_time=candles[exit_idx].time,
                    direction=plan.direction,
                    entry=round(entry, 8),
                    stop_loss=round(stop, 8),
                    take_profit=round(take, 8),
                    exit_price=round(exit_price, 8),
                    outcome=outcome,
                    r_multiple=round(r, 3),
                    pnl=round(pnl, 2),
                    confidence=sig.confidence,
                )
            )
            equity_curve.append(
                EquityPoint(time=candles[exit_idx].time, balance=round(equity, 2))
            )
            i = exit_idx + 1  # no overlapping positions
        else:
            i += 1

    stats = _summarize(trades, rr_planned, account_balance, equity, max_dd)

    return BacktestResponse(
        symbol=symbol.upper(),
        interval=interval,
        account_balance=account_balance,
        risk_pct=risk_pct,
        min_confidence=min_confidence,
        candles_tested=n,
        stats=stats,
        trades=trades,
        equity_curve=equity_curve,
    )


def _summarize(
    trades: list[BacktestTrade],
    rr_planned: list[float],
    account_balance: float,
    equity: float,
    max_dd: float,
) -> BacktestStats:
    total = len(trades)
    winners = [t for t in trades if t.pnl > 0]
    losers = [t for t in trades if t.pnl <= 0]
    gross_profit = sum(t.pnl for t in winners)
    gross_loss = -sum(t.pnl for t in losers)  # positive magnitude

    win_rate = (len(winners) / total * 100.0) if total else 0.0
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else None
    expectancy_r = (sum(t.r_multiple for t in trades) / total) if total else 0.0
    avg_win_r = (sum(t.r_multiple for t in winners) / len(winners)) if winners else 0.0
    avg_loss_r = (sum(t.r_multiple for t in losers) / len(losers)) if losers else 0.0
    avg_rr = (sum(rr_planned) / len(rr_planned)) if rr_planned else 0.0
    total_return_pct = (
        (equity - account_balance) / account_balance * 100.0 if account_balance else 0.0
    )

    return BacktestStats(
        total_trades=total,
        wins=len(winners),
        losses=len(losers),
        win_rate=round(win_rate, 1),
        profit_factor=round(profit_factor, 2) if profit_factor is not None else None,
        expectancy_r=round(expectancy_r, 3),
        avg_win_r=round(avg_win_r, 2),
        avg_loss_r=round(avg_loss_r, 2),
        avg_rr=round(avg_rr, 2),
        total_return_pct=round(total_return_pct, 2),
        final_balance=round(equity, 2),
        max_drawdown_pct=round(max_dd, 2),
    )
