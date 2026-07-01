"""Module 15 — Notifications endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from app.notifications import service as notify_service
from app.schemas.analysis import AlertRequest, AlertResult, NotifyStatus

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/status", response_model=NotifyStatus)
async def status() -> NotifyStatus:
    s = notify_service.status()
    return NotifyStatus(discord=s["discord"], telegram=s["telegram"])


@router.post("/alert", response_model=AlertResult)
async def alert(body: AlertRequest) -> AlertResult:
    sent = await notify_service.send_alert(body.title, body.message)
    return AlertResult(sent=sent)
