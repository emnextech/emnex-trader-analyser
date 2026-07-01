"""FastAPI application entrypoint."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_health, routes_market, ws_candles
from app.core.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Emnex AI Trader API",
    description="Phase 1 — live market data for the Emnex AI Trader platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router)
app.include_router(routes_market.router)
app.include_router(ws_candles.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "Emnex AI Trader API", "docs": "/docs", "health": "/api/health"}
