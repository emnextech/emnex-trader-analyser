import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

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
