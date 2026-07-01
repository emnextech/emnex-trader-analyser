"""REST endpoints for the analysis / drawing engine (Phase 2)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.analysis import service as analysis_service
from app.market import service as market_service
from app.schemas.analysis import (
    BacktestResponse,
    MentorChatRequest,
    MentorResponse,
    ScanResponse,
    SignalResponse,
    StructureResponse,
)
from app.schemas.market import TIMEFRAMES

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/structure", response_model=StructureResponse)
async def structure(
    symbol: str = Query(..., description="Clean symbol id, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Timeframe"),
    limit: int = Query(400, ge=50, le=1000),
) -> StructureResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    try:
        return await analysis_service.analyze_structure(symbol, interval, limit)
    except market_service.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/signal", response_model=SignalResponse)
async def signal(
    symbol: str = Query(..., description="Clean symbol id, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Timeframe"),
    account_balance: float = Query(10000.0, gt=0, description="Account size for sizing"),
    risk_pct: float = Query(1.0, gt=0, le=100, description="Risk per trade (%)"),
) -> SignalResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    try:
        return await analysis_service.analyze_signal(
            symbol, interval, account_balance, risk_pct
        )
    except market_service.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/mentor", response_model=MentorResponse)
async def mentor(
    symbol: str = Query(..., description="Clean symbol id, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Timeframe"),
) -> MentorResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    try:
        return await analysis_service.analyze_mentor(symbol, interval)
    except market_service.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/scan", response_model=ScanResponse)
async def scan(
    interval: str = Query("1h", description="Timeframe to scan"),
) -> ScanResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    return await analysis_service.scan_market(interval)


@router.get("/backtest", response_model=BacktestResponse)
async def backtest(
    symbol: str = Query(..., description="Clean symbol id, e.g. BTCUSDT"),
    interval: str = Query("1h", description="Timeframe"),
    account_balance: float = Query(10000.0, gt=0, description="Starting balance"),
    risk_pct: float = Query(1.0, gt=0, le=100, description="Risk per trade (%)"),
    min_confidence: int = Query(65, ge=0, le=100, description="Min confidence to take a trade"),
    limit: int = Query(600, ge=200, le=1000, description="Historical candles to replay"),
) -> BacktestResponse:
    if interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'")
    try:
        return await analysis_service.analyze_backtest(
            symbol, interval, account_balance, risk_pct, min_confidence, limit
        )
    except market_service.SymbolNotFound:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/mentor/chat")
async def mentor_chat(body: MentorChatRequest) -> StreamingResponse:
    if body.interval not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{body.interval}'")
    if not market_service.symbol_exists(body.symbol):
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{body.symbol}'")

    stream = analysis_service.mentor_chat_stream(body.symbol, body.interval, body.messages)
    return StreamingResponse(stream, media_type="text/plain; charset=utf-8")
