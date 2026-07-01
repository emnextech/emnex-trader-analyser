import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useCandles } from '../../hooks/useMarketData';
import { useLiveCandles } from '../../hooks/useLiveCandles';
import type { Candle } from '../../types/market';

interface ChartPanelProps {
  symbol: string;
  interval: string;
}

function toSeriesPoint(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

export function ChartPanel({ symbol, interval }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const { data: candles, isLoading, isError } = useCandles(symbol, interval);
  const [live, setLive] = useState<'connecting' | 'open' | 'closed'>('connecting');

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#FFFFFF' },
        textColor: '#5B6660',
        fontFamily: 'Inter, Space Grotesk, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#EEF1F6' },
        horzLines: { color: '#EEF1F6' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#E7EAE7' },
      timeScale: { borderColor: '#E7EAE7', timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#20AA6E',
      downColor: '#E5484D',
      borderUpColor: '#178A58',
      borderDownColor: '#C93B40',
      wickUpColor: '#20AA6E',
      wickDownColor: '#E5484D',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load history whenever candles change.
  useEffect(() => {
    if (!seriesRef.current || !candles) return;
    seriesRef.current.setData(candles.map(toSeriesPoint));
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Apply live updates.
  useLiveCandles(
    symbol,
    interval,
    (candle) => {
      seriesRef.current?.update(toSeriesPoint(candle));
    },
    setLive,
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {isLoading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-content-muted">
          Loading {symbol}…
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 grid place-items-center text-sm text-bear">
          Failed to load market data for {symbol}.
        </div>
      )}

      <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-content-muted backdrop-blur">
        <span
          className={`h-2 w-2 rounded-full ${
            live === 'open' ? 'bg-brand' : live === 'connecting' ? 'bg-amber-400' : 'bg-bear'
          }`}
        />
        {live === 'open' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline'}
      </div>
    </div>
  );
}
