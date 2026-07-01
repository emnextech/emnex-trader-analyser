"""Module 6 — Supply/Demand zones via the smart-money-concepts library.

Detects Order Blocks and Fair Value Gaps (FVG) and returns them as price/time
zones for the chart and the decision engine. We keep our own swing/structure
engines; this adds OB + FVG, which the SMC library specialises in.
"""
from __future__ import annotations

import contextlib
import io
import logging

import pandas as pd

from app.schemas.market import Candle
from app.schemas.analysis import Zone

logger = logging.getLogger(__name__)

# The package prints a unicode banner on import which crashes on Windows'
# cp1252 console — capture stdout during import to neutralise it.
with contextlib.redirect_stdout(io.StringIO()):
    from smartmoneyconcepts import smc


def _to_df(candles: list[Candle]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "open": [c.open for c in candles],
            "high": [c.high for c in candles],
            "low": [c.low for c in candles],
            "close": [c.close for c in candles],
            "volume": [c.volume for c in candles],
        }
    )


def _mitigated(value) -> tuple[bool, int | None]:
    """Interpret SMC MitigatedIndex (0/NaN = unmitigated)."""
    if value is None or pd.isna(value) or int(value) == 0:
        return False, None
    return True, int(value)


def detect_zones(candles: list[Candle], max_each: int = 5) -> list[Zone]:
    """Return the most recent unmitigated Order Blocks and FVGs."""
    if len(candles) < 30:
        return []

    df = _to_df(candles)
    times = [c.time for c in candles]
    last_time = times[-1]
    n = len(times)

    try:
        with contextlib.redirect_stdout(io.StringIO()):
            shl = smc.swing_highs_lows(df, swing_length=5)
            fvg_df = smc.fvg(df)
            ob_df = smc.ob(df, shl)
    except Exception:  # noqa: BLE001
        logger.exception("SMC zone detection failed")
        return []

    zones: list[Zone] = []

    def _count_tests(i: int, top: float, bottom: float, end_idx: int) -> int:
        """How many later candles wicked into the zone (retests)."""
        tests = 0
        for j in range(i + 1, min(end_idx + 1, n)):
            c = candles[j]
            if c.low <= top and c.high >= bottom:
                tests += 1
        return tests

    def collect(
        frame: pd.DataFrame, signal_col: str, kind: str, vol_col: str | None
    ) -> list[dict]:
        rows: list[dict] = []
        if frame is None or signal_col not in frame.columns:
            return rows
        for pos, val in frame[signal_col].items():
            if pd.isna(val):
                continue
            i = int(pos)
            if i >= n:
                continue
            mitigated, mit_idx = _mitigated(frame.at[pos, "MitigatedIndex"])
            top = frame.at[pos, "Top"]
            bottom = frame.at[pos, "Bottom"]
            if pd.isna(top) or pd.isna(bottom):
                continue
            hi = round(float(max(top, bottom)), 8)
            lo = round(float(min(top, bottom)), 8)
            end_idx = mit_idx if (mit_idx is not None and mit_idx < n) else n - 1
            tests = _count_tests(i, hi, lo, end_idx)
            vol = 0.0
            if vol_col and vol_col in frame.columns and not pd.isna(frame.at[pos, vol_col]):
                vol = float(frame.at[pos, vol_col])
            rows.append(
                {
                    "kind": kind,
                    "direction": "bullish" if val > 0 else "bearish",
                    "top": hi,
                    "bottom": lo,
                    "start_time": times[i],
                    "end_time": times[end_idx] if end_idx < n else last_time,
                    "mitigated": mitigated,
                    "tests": tests,
                    "vol": vol,
                }
            )
        return rows

    ob_rows = collect(ob_df, "OB", "order_block", "OBVolume")
    fvg_rows = collect(fvg_df, "FVG", "fvg", None)
    max_ob_vol = max((r["vol"] for r in ob_rows), default=0.0)

    def finalize(rows: list[dict]) -> list[Zone]:
        out: list[Zone] = []
        for r in rows:
            if r["mitigated"]:
                continue  # only fresh/unmitigated zones are actionable
            fresh = r["tests"] == 0
            s = 40
            if r["kind"] == "order_block":
                s += 15
                if max_ob_vol > 0:
                    s += int(min(r["vol"] / max_ob_vol, 1.0) * 20)
            s += 25 if fresh else min(r["tests"], 3) * 7
            s = max(0, min(100, s))

            side = "Demand" if r["direction"] == "bullish" else "Supply"
            base = "OB" if r["kind"] == "order_block" else "FVG"
            institutional = r["kind"] == "order_block" and s >= 75
            label = f"{'Institutional ' if institutional else ''}{side} {base}"

            out.append(
                Zone(
                    kind=r["kind"],  # type: ignore[arg-type]
                    direction=r["direction"],  # type: ignore[arg-type]
                    top=r["top"],
                    bottom=r["bottom"],
                    start_time=r["start_time"],
                    end_time=r["end_time"],
                    mitigated=False,
                    fresh=fresh,
                    tests=r["tests"],
                    strength=s,
                    label=label,
                )
            )
        # Strongest first, then most recent; cap to stay clean.
        out.sort(key=lambda z: (z.strength, z.start_time), reverse=True)
        return out[:max_each]

    zones.extend(finalize(ob_rows))
    zones.extend(finalize(fvg_rows))
    return zones
