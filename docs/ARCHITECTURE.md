# Architecture

> Phase 1 (Foundation). The full product vision lives in [PROJECT_PLAN.md](../PROJECT_PLAN.md).

```
Frontend (React/Vite)
   │  REST + WebSocket
   ▼
FastAPI backend
   │
   ├── market/      Module 1 — Live Market Data (implemented)
   │     ├── base.py        MarketDataProvider ABC
   │     ├── binance.py     crypto — REST klines + WS stream
   │     ├── yahoo.py       forex/gold/indices/stocks — yfinance + TTL cache
   │     ├── symbols.py     symbol catalog → provider + native symbol
   │     └── service.py     routes a symbol to its provider; live dispatcher
   │
   ├── auth/        Appwrite server client (server-side DB writes, future)
   │
   └── (scaffolded, empty)  Modules 3–20:
         analysis · drawing · structure · candlestick · supply_demand ·
         trendline · swing · decision · confidence · risk · journal ·
         scanner · notifications · backtesting · ml
```

## Data flow

1. Frontend requests `GET /api/markets/candles?symbol=&interval=&limit=` for history.
2. Backend looks the symbol up in the catalog, picks the provider, returns normalized `Candle[]`.
3. Frontend opens `WS /ws/candles?symbol=&interval=` for live updates:
   - **Binance** symbols → genuine exchange WebSocket relayed to the client.
   - **Yahoo** symbols → backend polls + caches and emits the latest candle on an interval.
4. The frontend sees one unified candle stream regardless of provider.

## Symbol contract

The API uses clean symbol IDs (e.g. `BTCUSDT`, `EURUSD`, `XAUUSD`) — never the provider-native strings
(`BTCUSDT`, `EURUSD=X`, `GC=F`, `^GSPC`) which contain URL-unfriendly characters. The catalog in
`market/symbols.py` is the single mapping from clean ID → `{provider, native}`.

## Adding a provider later

Implement `MarketDataProvider` (`get_candles`, optionally `stream`), register it in `service.py`,
and add catalog entries pointing symbols at it. No frontend changes required.

## Theme

Frontend reuses the Emnex portfolio design system verbatim: `tailwind.config.js` (emerald `brand`,
`ink`, `surface`, `content` palettes; Space Grotesk + Inter) and `src/index.css` component classes
(`.btn`, `.orb`, `.display`, `.container-page`, `.panel-muted`, …). Animations are CSS-only.
