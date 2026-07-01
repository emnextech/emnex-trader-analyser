# Emnex AI Trader

Professional AI-powered market analysis platform. See [docs/PROJECT_PLAN.md](PROJECT_PLAN.md) for the full vision and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the technical design.

This repo currently implements **Phase 1 — Foundation**: live candlestick charts for forex, gold, crypto, indices and stocks, fed by free (keyless) market data, with Appwrite auth scaffolding. Styled to match the [Emnex portfolio](https://github.com/) design system (emerald/ink theme, Space Grotesk + Inter).

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS, TanStack Query, Zustand, TradingView Lightweight Charts, Appwrite Web SDK.
- **Backend:** Python + FastAPI + Uvicorn. Market data via Binance (crypto, real WebSocket) and Yahoo Finance / `yfinance` (forex, gold, indices, stocks).
- **Auth + DB:** Appwrite.

## Market data — no API keys required

- **Crypto** (BTC, ETH): [Binance public API](https://www.binance.com/en/binance-api) — REST history + real-time WebSocket. No key.
- **Forex, gold, indices, stocks**: [Yahoo Finance via `yfinance`](https://github.com/ranaroussi/yfinance) — REST history; backend polls + caches the latest candle. No key.

Both sit behind one provider abstraction (`backend/app/market/`), so additional providers can be added without touching the frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+

## Run the backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    |    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in Appwrite values (optional for charts)
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000 — docs at http://localhost:8000/docs.

Quick checks:
- `GET /api/health`
- `GET /api/markets/symbols`
- `GET /api/markets/candles?symbol=BTCUSDT&interval=1h&limit=200`
- `WS  /ws/candles?symbol=BTCUSDT&interval=1m`

## Run the frontend

```bash
cd frontend
npm install
cp .env.example .env          # set VITE_APPWRITE_* (optional for charts); VITE_API_URL defaults to localhost:8000
npm run dev
```

Frontend runs at http://localhost:5173.

## Notes

- **Charts work with zero credentials.** Only the login screen needs Appwrite endpoint + project ID.
- `yfinance` is unofficial/scraping-based; the backend caches aggressively and polls modestly to avoid IP blocks.
- Never commit `.env`. Rotate any key that has been shared in plaintext.
