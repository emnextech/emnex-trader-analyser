"""Module 13 — AI Mentor.

Turns the structured Phase 2-4 analysis into a calm, educational explanation
using a chat LLM. Provider-agnostic and optional: works with free providers
(Groq, Gemini via their OpenAI-compatible endpoints) or Anthropic. Active only
when the selected provider's API key is configured.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.core.config import settings
from app.schemas.analysis import ChatMessage, SignalResponse, StructureResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Emnex AI, a professional trading mentor. You explain \
market analysis to a trader in clear, calm, educational language — the way a \
seasoned mentor talks a student through a chart.

You are given a JSON snapshot of an automated analysis (trend, market structure, \
support/resistance, order blocks, fair value gaps, momentum, a candlestick \
pattern, and a rule-based decision with a risk plan). Explain what it means.

Rules:
- Use ONLY the numbers and facts in the data. Never invent price levels, \
percentages, or events.
- Structure your answer with these short sections (use them as headers):
  **The read** — one or two sentences on the overall picture.
  **Why** — the key evidence (structure, momentum, zones, pattern) in plain terms.
  **The plan** — entry, stop, target and risk:reward if a risk plan is present; \
otherwise say why it's a wait.
  **Watch for** — what would confirm or invalidate the idea.
- ~150-220 words total. Be concise and concrete. Define jargon briefly (e.g. \
"BOS — a break of structure").
- End with one short line: "Educational analysis, not financial advice."
- Never be hype-y or promise profits."""

CHAT_SYSTEM_PROMPT = """You are Emnex AI, a professional trading mentor having a \
conversation with a trader. A JSON snapshot of the current automated analysis for \
the chart they're viewing is provided below — use it to ground your answers.

Rules:
- Answer the trader's questions clearly and concisely (usually 2-5 sentences).
- Base any market claims on the provided snapshot; never invent price levels, \
percentages, or events. If the snapshot doesn't contain something, say so.
- Explain concepts simply and define jargon briefly when you use it.
- Stay educational and calm. Never hype or promise profits. This is not financial \
advice.

Current analysis snapshot:
"""

# OpenAI-compatible providers (free tiers). One HTTP shape serves both.
_OPENAI_COMPAT = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "key": lambda: settings.groq_api_key,
    },
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "default_model": "gemini-2.0-flash",
        "key": lambda: settings.gemini_api_key,
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
        "key": lambda: settings.openai_api_key,
    },
}


def _active_provider() -> str | None:
    """Return the configured provider with a usable key, honouring AI_PROVIDER."""
    pref = (settings.ai_provider or "").lower()
    order = [pref] + [p for p in ("groq", "gemini", "openai", "anthropic") if p != pref]
    for name in order:
        if name == "anthropic" and settings.anthropic_api_key:
            return "anthropic"
        if name in _OPENAI_COMPAT and _OPENAI_COMPAT[name]["key"]():
            return name
    return None


def is_configured() -> bool:
    return _active_provider() is not None


def active_provider_name() -> str:
    return _active_provider() or "none"


def _build_context(
    symbol: str, interval: str, structure: StructureResponse, signal: SignalResponse
) -> str:
    """Compact, model-friendly snapshot of the analysis."""
    last_events = [e.model_dump() for e in structure.events[-4:]]
    payload = {
        "symbol": symbol,
        "timeframe": interval,
        "trend": structure.trend,
        "trend_strength_pct": structure.trend_strength,
        "phase": structure.phase,
        "recent_structure_events": last_events,
        "support_resistance": [lv.model_dump() for lv in structure.levels[:6]],
        "zones_order_blocks_and_fvg": [z.model_dump() for z in structure.zones[:6]],
        "momentum_rsi": signal.momentum_rsi,
        "candlestick_pattern": signal.pattern.model_dump() if signal.pattern else None,
        "decision": signal.decision,
        "bias": signal.bias,
        "confidence_pct": signal.confidence,
        "scores": signal.scores.model_dump(),
        "risk_plan": signal.risk.model_dump() if signal.risk else None,
        "rule_based_reasons": signal.reasons,
    }
    return json.dumps(payload, indent=2)


async def _generate_openai_compat(provider: str, user_content: str) -> str:
    cfg = _OPENAI_COMPAT[provider]
    model = settings.mentor_model or cfg["default_model"]
    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            f"{cfg['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['key']()}"},
            json={
                "model": model,
                "max_tokens": 1200,
                "temperature": 0.4,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


async def _generate_anthropic(user_content: str) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=settings.mentor_model or "claude-opus-4-8",
        max_tokens=1200,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    if response.stop_reason == "refusal":
        return "The AI mentor could not generate an explanation for this request."
    return "\n".join(b.text for b in response.content if b.type == "text").strip()


async def generate_explanation(
    symbol: str, interval: str, structure: StructureResponse, signal: SignalResponse
) -> str:
    """Produce the mentor explanation using the active provider. Plain text."""
    provider = _active_provider()
    if provider is None:
        return ""

    context = _build_context(symbol, interval, structure, signal)
    user_content = (
        f"Here is the current analysis for {symbol} on the {interval} "
        f"timeframe:\n\n{context}\n\nExplain it as my mentor."
    )

    try:
        if provider == "anthropic":
            return await _generate_anthropic(user_content)
        return await _generate_openai_compat(provider, user_content)
    except Exception:  # noqa: BLE001
        logger.exception("AI mentor (%s) failed for %s %s", provider, symbol, interval)
        return "The AI mentor is temporarily unavailable. Please try again shortly."


# --- Streaming chat (follow-up questions) ---


async def _stream_openai_compat(
    provider: str, system: str, history: list[dict]
) -> AsyncIterator[str]:
    cfg = _OPENAI_COMPAT[provider]
    model = settings.mentor_model or cfg["default_model"]
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            f"{cfg['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['key']()}"},
            json={
                "model": model,
                "max_tokens": 1000,
                "temperature": 0.4,
                "stream": True,
                "messages": [{"role": "system", "content": system}, *history],
            },
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta


async def _stream_anthropic(system: str, history: list[dict]) -> AsyncIterator[str]:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model=settings.mentor_model or "claude-opus-4-8",
        max_tokens=1000,
        system=system,
        messages=history,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def stream_chat(
    symbol: str,
    interval: str,
    structure: StructureResponse,
    signal: SignalResponse,
    messages: list[ChatMessage],
) -> AsyncIterator[str]:
    """Stream a mentor reply to the conversation, grounded in the analysis."""
    provider = _active_provider()
    if provider is None:
        yield "The AI mentor isn't configured. Add a free GROQ_API_KEY to backend/.env."
        return

    system = CHAT_SYSTEM_PROMPT + _build_context(symbol, interval, structure, signal)
    history = [{"role": m.role, "content": m.content} for m in messages]

    try:
        if provider == "anthropic":
            async for chunk in _stream_anthropic(system, history):
                yield chunk
        else:
            async for chunk in _stream_openai_compat(provider, system, history):
                yield chunk
    except Exception:  # noqa: BLE001
        logger.exception("AI mentor chat (%s) failed for %s %s", provider, symbol, interval)
        yield "\n\n[The AI mentor hit an error. Please try again.]"
