"""REST endpoints for market data (Module 1)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.market import service
from app.schemas.market import CandlesResponse, Symbol, TIMEFRAMES

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("/symbols", response_model=list[Symbol])
async def get_symbols() -> list[Symbol]:
    return service.list_symbols()


@router.get("/timeframes", response_model=list[str])
async def get_timeframes() -> list[str]:
    return service.list_timeframes()


@router.get("/candles", response_model=CandlesResponse)
async def get_candles(
    symbol: str = Query(..., description="Clean symbol id, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Timeframe"),
    limit: int = Query(500, ge=1, le=1000),
) -> CandlesResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    try:
        candles = await service.get_candles(symbol, interval, limit)
    except service.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return CandlesResponse(symbol=symbol.upper(), interval=interval, candles=candles)
