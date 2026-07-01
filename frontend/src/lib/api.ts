import axios from 'axios';

/**
 * Resolve the backend base URL.
 *
 * When you open the app from another machine on the LAN, `localhost` would
 * point at *that* machine — not the host running the API. So if the page is
 * served from a real host/IP but the API is configured (or defaulted) to
 * localhost, rewrite it to the host that served the page (same box runs both).
 */
function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const viewingRemotely = host !== 'localhost' && host !== '127.0.0.1';

  if (configured) {
    if (viewingRemotely && /localhost|127\.0\.0\.1/.test(configured)) {
      return configured.replace(/localhost|127\.0\.0\.1/, host);
    }
    return configured;
  }
  return `http://${host}:8000`;
}

export const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

/** Build the WebSocket URL for the candle stream from the API base URL. */
export function wsCandlesUrl(symbol: string, interval: string): string {
  const wsBase = API_URL.replace(/^http/, 'ws');
  const params = new URLSearchParams({ symbol, interval });
  return `${wsBase}/ws/candles?${params.toString()}`;
}
