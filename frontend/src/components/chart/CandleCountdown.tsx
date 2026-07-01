import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

// Fixed candle durations in seconds (UTC-aligned, like the current-bar timer).
const DURATIONS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

function remaining(interval: string): number | null {
  const dur = DURATIONS[interval];
  if (!dur) return null; // weekly/monthly are calendar-based — skip the timer
  const now = Math.floor(Date.now() / 1000);
  return dur - (now % dur);
}

function format(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Countdown to the close of the current candle (TradingView-style). */
export function CandleCountdown({ interval }: { interval: string }) {
  const [left, setLeft] = useState<number | null>(() => remaining(interval));

  useEffect(() => {
    setLeft(remaining(interval));
    const id = window.setInterval(() => setLeft(remaining(interval)), 1000);
    return () => window.clearInterval(id);
  }, [interval]);

  if (left == null) return null;

  const urgent = left <= 10;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold tabular-nums backdrop-blur ${
        urgent ? 'text-bear' : 'text-content'
      }`}
      title="Time until this candle closes"
    >
      <Timer className={`h-3.5 w-3.5 ${urgent ? 'text-bear' : 'text-content-subtle'}`} />
      {format(left)}
    </div>
  );
}
