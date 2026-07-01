import type { Timeframe } from '../../types/market';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-surface-muted p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          type="button"
          onClick={() => onChange(tf)}
          className={`focus-ring rounded-lg px-2.5 py-1 text-sm font-semibold transition ${
            value === tf
              ? 'bg-white text-content shadow-sm'
              : 'text-content-muted hover:text-content'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
