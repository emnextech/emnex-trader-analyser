import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useCandles } from '../../hooks/useMarketData';
import { useLiveCandles } from '../../hooks/useLiveCandles';
import { useStructure } from '../../hooks/useStructure';
import { Spinner } from '../ui/Spinner';
import { ZonesPrimitive } from './zonePrimitive';
import { CandleCountdown } from './CandleCountdown';
import type { Candle } from '../../types/market';
import type { DrawingToggles } from '../../store/chartStore';

interface ChartPanelProps {
  symbol: string;
  interval: string;
  drawings: DrawingToggles;
}

const BULL = '#20AA6E';
const BEAR = '#E5484D';

function toSeriesPoint(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

export function ChartPanel({ symbol, interval, drawings }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Overlay handles so we can clear them before each redraw.
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const trendSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const eventSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const lastTimeRef = useRef<number>(0);
  const fitKeyRef = useRef<string>('');

  // Zone boxes (Order Blocks / FVG) drawn via a chart series primitive so they
  // stay pixel-aligned and redraw with the chart automatically.
  const zonesPrimRef = useRef<ZonesPrimitive | null>(null);

  const { data: candles, isLoading, isError } = useCandles(symbol, interval);
  const { data: structure } = useStructure(symbol, interval);
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
      upColor: BULL,
      downColor: BEAR,
      borderUpColor: '#178A58',
      borderDownColor: '#C93B40',
      wickUpColor: BULL,
      wickDownColor: BEAR,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Zone boxes as a series primitive — auto-redraws with the chart.
    const zonesPrim = new ZonesPrimitive();
    series.attachPrimitive(zonesPrim);
    zonesPrimRef.current = zonesPrim;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      zonesPrimRef.current = null;
      priceLinesRef.current = [];
      trendSeriesRef.current = [];
      eventSeriesRef.current = [];
    };
  }, []);

  // Block live updates until fresh history for the new symbol/interval loads.
  useEffect(() => {
    lastTimeRef.current = Number.MAX_SAFE_INTEGER;
  }, [symbol, interval]);

  // Load history whenever candles change. Never wipe the chart on an empty
  // response (e.g. a transient rate-limit) — keep the last good data.
  useEffect(() => {
    if (!seriesRef.current || !candles || candles.length === 0) return;
    seriesRef.current.setData(candles.map(toSeriesPoint));
    lastTimeRef.current = candles[candles.length - 1].time;
    // Only auto-fit once per symbol/timeframe — preserve the user's zoom/pan
    // across background refetches and live updates.
    const key = `${symbol}:${interval}`;
    if (fitKeyRef.current !== key) {
      chartRef.current?.timeScale().fitContent();
      fitKeyRef.current = key;
    }
  }, [candles, symbol, interval]);

  // Sync zone data + visibility into the primitive.
  useEffect(() => {
    zonesPrimRef.current?.setData(structure?.zones ?? [], drawings.zones);
  }, [structure, drawings.zones]);

  // Draw / redraw analysis overlays when structure or toggles change.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    // Clear existing overlays.
    priceLinesRef.current.forEach((pl) => series.removePriceLine(pl));
    priceLinesRef.current = [];
    trendSeriesRef.current.forEach((s) => chart.removeSeries(s));
    trendSeriesRef.current = [];
    eventSeriesRef.current.forEach((s) => chart.removeSeries(s));
    eventSeriesRef.current = [];
    series.setMarkers([]);

    if (!structure) return;

    const markers: SeriesMarker<Time>[] = [];

    // Swing markers (major swings only, to avoid clutter).
    if (drawings.swings) {
      for (const s of structure.swings.filter((sw) => sw.strength === 'major')) {
        markers.push({
          time: s.time as UTCTimestamp,
          position: s.kind === 'high' ? 'aboveBar' : 'belowBar',
          color: s.kind === 'high' ? BEAR : BULL,
          shape: s.kind === 'high' ? 'arrowDown' : 'arrowUp',
          text: s.label ?? (s.kind === 'high' ? 'H' : 'L'),
        });
      }
    }

    // BOS / CHoCH structure events — draw the broken level + a label marker.
    if (drawings.structure) {
      const recent = structure.events.slice(-8);
      for (const ev of recent) {
        const color = ev.direction === 'bullish' ? BULL : BEAR;
        const lineSeries = chart.addLineSeries({
          color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        lineSeries.setData([
          { time: ev.from_time as UTCTimestamp, value: ev.price },
          { time: ev.time as UTCTimestamp, value: ev.price },
        ]);
        eventSeriesRef.current.push(lineSeries);
        markers.push({
          time: ev.time as UTCTimestamp,
          position: ev.direction === 'bullish' ? 'belowBar' : 'aboveBar',
          color,
          shape: ev.direction === 'bullish' ? 'arrowUp' : 'arrowDown',
          text: ev.type,
        });
      }
    }

    // Candlestick pattern marks.
    if (drawings.patterns) {
      for (const p of structure.patterns) {
        const abbr = p.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 3)
          .toUpperCase();
        markers.push({
          time: p.time as UTCTimestamp,
          position: p.bias === 'bearish' ? 'aboveBar' : 'belowBar',
          color: p.bias === 'bullish' ? BULL : p.bias === 'bearish' ? BEAR : '#8A938D',
          shape: 'circle',
          text: abbr,
        });
      }
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(markers);

    // Support / resistance horizontal levels.
    if (drawings.levels) {
      structure.levels.forEach((lv) => {
        const pl = series.createPriceLine({
          price: lv.price,
          color: lv.kind === 'resistance' ? BEAR : BULL,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${lv.kind === 'resistance' ? 'R' : 'S'} ×${lv.touches}`,
        });
        priceLinesRef.current.push(pl);
      });
    }

    // Fibonacci retracement levels.
    if (drawings.fib && structure.fibonacci) {
      for (const f of structure.fibonacci.levels) {
        const pl = series.createPriceLine({
          price: f.price,
          color: '#B4820A',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `fib ${f.ratio}`,
        });
        priceLinesRef.current.push(pl);
      }
    }

    // Previous day/week key levels (PDH/PDL/PWH/PWL).
    if (drawings.keyLevels) {
      for (const kl of structure.key_levels) {
        const pl = series.createPriceLine({
          price: kl.price,
          color: '#6B5BD2',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: kl.label,
        });
        priceLinesRef.current.push(pl);
      }
    }

    // Diagonal trendlines (each is its own 2-point line series).
    if (drawings.trendlines) {
      structure.trendlines.forEach((tl) => {
        const lineSeries = chart.addLineSeries({
          color: tl.kind === 'resistance' ? BEAR : BULL,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        lineSeries.setData([
          { time: tl.start.time as UTCTimestamp, value: tl.start.price },
          { time: tl.end.time as UTCTimestamp, value: tl.end.price },
        ]);
        trendSeriesRef.current.push(lineSeries);
      });
    }
  }, [
    structure,
    drawings.swings,
    drawings.levels,
    drawings.trendlines,
    drawings.structure,
    drawings.fib,
    drawings.keyLevels,
    drawings.patterns,
    candles,
  ]);

  // Apply live updates to the candle series.
  useLiveCandles(
    symbol,
    interval,
    (candle) => {
      // lightweight-charts throws if you update with a time older than the last
      // bar — ignore stale/out-of-order ticks from polled providers.
      if (!seriesRef.current || candle.time < lastTimeRef.current) return;
      seriesRef.current.update(toSeriesPoint(candle));
      lastTimeRef.current = candle.time;
    },
    setLive,
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {isLoading && (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner size={28} label={`Loading ${symbol}…`} />
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 grid place-items-center text-sm text-bear">
          Failed to load market data for {symbol}.
        </div>
      )}

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <CandleCountdown interval={interval} />
        <div className="flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-medium text-content-muted backdrop-blur">
          <span
            className={`h-2 w-2 rounded-full ${
              live === 'open'
                ? 'bg-brand'
                : live === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-bear'
            }`}
          />
          {live === 'open' ? 'Live' : live === 'connecting' ? 'Connecting' : 'Offline'}
        </div>
      </div>
    </div>
  );
}
