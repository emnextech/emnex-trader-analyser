import type { Timeframe } from '../../types/market';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full bg-surface-muted p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          onClick={() => onChange(tf)}
          className={`focus-ring rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
            value === tf
              ? 'bg-ink text-white'
              : 'text-content-muted hover:text-content'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
