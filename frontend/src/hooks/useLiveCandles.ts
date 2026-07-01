import { useEffect, useRef } from 'react';
import { wsCandlesUrl } from '../lib/api';
import type { Candle } from '../types/market';

type Status = 'connecting' | 'open' | 'closed';

/**
 * Subscribe to the backend live-candle WebSocket for a symbol/timeframe.
 * Calls `onCandle` for every incoming candle update (new or in-progress).
 */
export function useLiveCandles(
  symbol: string,
  interval: string,
  onCandle: (candle: Candle) => void,
  onStatus?: (status: Status) => void,
) {
  // Keep latest callbacks in refs so reconnects only depend on symbol/interval.
  const onCandleRef = useRef(onCandle);
  const onStatusRef = useRef(onStatus);
  onCandleRef.current = onCandle;
  onStatusRef.current = onStatus;

  useEffect(() => {
    if (!symbol || !interval) return;

    let ws: WebSocket | null = null;
    let closedByCleanup = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      onStatusRef.current?.('connecting');
      ws = new WebSocket(wsCandlesUrl(symbol, interval));

      ws.onopen = () => onStatusRef.current?.('open');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'candle' && msg.data) {
            onCandleRef.current(msg.data as Candle);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onclose = () => {
        onStatusRef.current?.('closed');
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [symbol, interval]);
}
