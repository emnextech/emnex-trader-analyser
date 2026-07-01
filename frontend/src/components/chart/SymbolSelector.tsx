import { ChevronDown } from 'lucide-react';
import { useSymbols } from '../../hooks/useMarketData';

interface Props {
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolSelector({ value, onChange }: Props) {
  const { data: symbols, isLoading } = useSymbols();

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className="focus-ring appearance-none rounded-full border border-line bg-white py-2.5 pl-5 pr-11 text-sm font-semibold text-content disabled:opacity-60"
      >
        {(symbols ?? []).map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.name} · {s.symbol}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
        aria-hidden
      />
    </div>
  );
}
