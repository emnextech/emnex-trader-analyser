import { useState } from 'react';
import {
  Activity,
  Minus,
  TrendingUp,
  GitBranch,
  Square,
  Percent,
  Flag,
  Shapes,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import type { DrawingToggles } from '../../store/chartStore';

interface Props {
  value: DrawingToggles;
  onToggle: (key: keyof DrawingToggles) => void;
}

const items: {
  key: keyof DrawingToggles;
  label: string;
  hint: string;
  icon: typeof Activity;
}[] = [
  { key: 'trendlines', label: 'Trendlines', hint: 'Auto trendlines', icon: TrendingUp },
  { key: 'levels', label: 'Support / Resistance', hint: 'Key horizontal levels', icon: Minus },
  { key: 'structure', label: 'Market structure', hint: 'BOS / CHoCH', icon: GitBranch },
  { key: 'swings', label: 'Swing points', hint: 'HH / HL / LH / LL', icon: Activity },
  { key: 'zones', label: 'Supply / Demand', hint: 'Order blocks & FVG', icon: Square },
  { key: 'fib', label: 'Fibonacci', hint: 'Retracement levels', icon: Percent },
  { key: 'keyLevels', label: 'Prev D/W levels', hint: 'PDH · PDL · PWH · PWL', icon: Flag },
  { key: 'patterns', label: 'Candlestick marks', hint: 'Detected patterns', icon: Shapes },
];

export function DrawingsPanel({ value, onToggle }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(value).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`focus-ring inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm font-semibold transition ${
          open
            ? 'border-brand bg-brand/10 text-brand-dark'
            : 'border-line text-content-muted hover:text-content'
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">Indicators</span>
        <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {activeCount}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-up overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-soft">
            <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-content-subtle">
              Analysis tools
            </p>
            {items.map(({ key, label, hint, icon: Icon }) => {
              const on = value[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggle(key)}
                  className="focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-muted"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      on ? 'bg-brand/10 text-brand-dark' : 'bg-surface-sunken text-content-subtle'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-content">{label}</span>
                    <span className="block truncate text-xs text-content-subtle">{hint}</span>
                  </span>
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                      on ? 'border-brand bg-brand text-white' : 'border-line text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
