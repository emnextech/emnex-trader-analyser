import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Bitcoin, DollarSign, Coins, BarChart3, Building2 } from 'lucide-react';
import { useSymbols } from '../../hooks/useMarketData';
import type { MarketSymbol, MarketType } from '../../types/market';

interface Props {
  open: boolean;
  value: string;
  onChange: (symbol: string) => void;
  onClose: () => void;
}

const TYPE_ORDER: MarketType[] = ['crypto', 'forex', 'commodity', 'index', 'stock'];

const TYPE_META: Record<MarketType, { label: string; icon: typeof Bitcoin }> = {
  crypto: { label: 'Crypto', icon: Bitcoin },
  forex: { label: 'Forex', icon: DollarSign },
  commodity: { label: 'Commodities', icon: Coins },
  index: { label: 'Indices', icon: BarChart3 },
  stock: { label: 'Stocks', icon: Building2 },
};

export function SymbolModal({ open, value, onChange, onClose }: Props) {
  const { data: symbols } = useSymbols();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flat, type-ordered, filtered list (drives keyboard navigation).
  const filtered = useMemo(() => {
    const all = symbols ?? [];
    const q = query.trim().toLowerCase();
    const matches = all.filter(
      (s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
    return matches.sort(
      (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
    );
  }, [symbols, query]);

  // Group consecutive items by type for rendering.
  const groups = useMemo(() => {
    const out: { type: MarketType; items: MarketSymbol[] }[] = [];
    for (const s of filtered) {
      const last = out[out.length - 1];
      if (last && last.type === s.type) last.items.push(s);
      else out.push({ type: s.type, items: [s] });
    }
    return out;
  }, [filtered]);

  // Reset + focus on open; lock body scroll.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, [open]);

  // Keep active index in range when the filter changes.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!open) return null;

  const select = (symbol: string) => {
    onChange(symbol);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = filtered[active];
      if (sel) select(sel.symbol);
    }
  };

  // Scroll active row into view.
  const flatIndex = (s: MarketSymbol) => filtered.indexOf(s);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      onKeyDown={onKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-ink-deep/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[72vh] w-full max-w-xl animate-fade-up flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-line">
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-content-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search markets — e.g. BTC, gold, EUR, Apple…"
            className="w-full bg-transparent text-base text-content outline-none placeholder:text-content-subtle"
          />
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-1 text-content-subtle hover:bg-surface-muted hover:text-content"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-content-muted">
              No markets match “{query}”.
            </p>
          )}

          {groups.map((group) => {
            const Meta = TYPE_META[group.type];
            return (
              <div key={group.type} className="mb-1">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-content-subtle">
                  <Meta.icon className="h-3.5 w-3.5" />
                  {Meta.label}
                </div>
                {group.items.map((s) => {
                  const idx = flatIndex(s);
                  const isActive = idx === active;
                  const isSelected = s.symbol === value;
                  return (
                    <button
                      key={s.symbol}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => select(s.symbol)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                        isActive ? 'bg-surface-muted' : ''
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold ${
                            isSelected ? 'bg-brand text-white' : 'bg-surface-sunken text-content'
                          }`}
                        >
                          {s.symbol.slice(0, 2)}
                        </span>
                        <span className="leading-tight">
                          <span className="block font-semibold text-content">{s.symbol}</span>
                          <span className="block text-xs text-content-muted">{s.name}</span>
                        </span>
                      </span>
                      {isSelected && <span className="tag-brand">Selected</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-content-subtle">
          <span>{filtered.length} markets</span>
          <span className="hidden sm:inline">↑ ↓ to navigate · ↵ to select · esc to close</span>
        </div>
      </div>
    </div>
  );
}
