"""WebSocket endpoint streaming live candle updates to the frontend.

Bridges the per-symbol provider stream (real WebSocket for Binance, polling loop
for Yahoo) to the connected client as JSON candle messages.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.market import service
from app.schemas.market import TIMEFRAMES

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/candles")
async def ws_candles(websocket: WebSocket) -> None:
    await websocket.accept()
    symbol = websocket.query_params.get("symbol", "")
    interval = websocket.query_params.get("interval", "1h")

    if interval not in TIMEFRAMES:
        await websocket.send_json({"type": "error", "message": f"invalid interval '{interval}'"})
        await websocket.close()
        return

    if not service.symbol_exists(symbol):
        await websocket.send_json({"type": "error", "message": f"unknown symbol '{symbol}'"})
        await websocket.close()
        return

    try:
        async for candle in service.stream(symbol, interval):
            await websocket.send_json({"type": "candle", "data": candle.model_dump()})
    except WebSocketDisconnect:
        logger.info("Client disconnected from %s %s stream", symbol, interval)
    except Exception:  # noqa: BLE001
        logger.exception("Stream error for %s %s", symbol, interval)
        try:
            await websocket.close()
        except RuntimeError:
            pass
