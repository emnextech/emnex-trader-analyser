import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useRiskStore } from '../../store/riskStore';
import { useSymbols } from '../../hooks/useMarketData';
import type { SignalResponse } from '../../types/analysis';

interface Props {
  symbol: string;
  signal: SignalResponse;
}

// Contract size + pip per market type (MetaTrader conventions).
function marketMeta(type: string | undefined, symbol: string) {
  const jpy = symbol.includes('JPY');
  switch (type) {
    case 'forex':
      return { contract: 100_000, pip: jpy ? 0.01 : 0.0001, lotLabel: 'Lots', pipLabel: 'pips' };
    case 'commodity':
      return { contract: 100, pip: 0.1, lotLabel: 'Lots', pipLabel: 'pts' };
    case 'crypto':
      return { contract: 1, pip: 0, lotLabel: 'Lots', pipLabel: '' };
    default:
      return { contract: 1, pip: 0, lotLabel: 'Units', pipLabel: '' };
  }
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number, d = 4) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d });

function Field({
  label,
  value,
  onChange,
  step,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
        {label}
      </span>
      <div className="flex items-center rounded-lg border border-line bg-white focus-within:border-brand">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-2.5 py-1.5 text-sm text-content outline-none"
        />
        {suffix && <span className="pr-2.5 text-xs text-content-subtle">{suffix}</span>}
      </div>
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-content-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ?? 'text-content'}`}>{value}</span>
    </div>
  );
}

export function RiskCalculator({ symbol, signal }: Props) {
  const { accountBalance, riskPct, leverage, set } = useRiskStore();
  const { data: symbols } = useSymbols();
  const meta = marketMeta(symbols?.find((s) => s.symbol === symbol)?.type, symbol);

  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [tp, setTp] = useState('');
  const prefilledFor = useRef('');

  // Prefill trade levels from the live setup once per symbol (keeps user edits).
  useEffect(() => {
    const r = signal.risk;
    if (r && prefilledFor.current !== symbol) {
      setEntry(String(r.entry));
      setStop(String(r.stop_loss));
      setTp(String(r.take_profit));
      prefilledFor.current = symbol;
    }
  }, [signal, symbol]);

  const resetLevels = () => {
    const r = signal.risk;
    if (!r) return;
    setEntry(String(r.entry));
    setStop(String(r.stop_loss));
    setTp(String(r.take_profit));
  };

  const e = parseFloat(entry) || 0;
  const sl = parseFloat(stop) || 0;
  const target = parseFloat(tp) || 0;

  const riskPerUnit = Math.abs(e - sl);
  const rewardPerUnit = target ? Math.abs(target - e) : 0;
  const riskAmount = accountBalance * (riskPct / 100);
  const units = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  const lots = units / meta.contract;
  const notional = units * e;
  const margin = leverage > 0 ? notional / leverage : notional;
  const rr = riskPerUnit > 0 && rewardPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
  const rewardAmount = riskAmount * rr;
  const slPips = meta.pip > 0 ? riskPerUnit / meta.pip : 0;
  const distPct = e > 0 ? (riskPerUnit / e) * 100 : 0;
  const direction = sl && e ? (sl < e ? 'Long' : 'Short') : '—';
  const valid = e > 0 && riskPerUnit > 0;

  return (
    <div className="space-y-3">
      {/* Account inputs */}
      <div className="grid grid-cols-3 gap-2">
        <Field
          label="Balance"
          value={String(accountBalance)}
          onChange={(v) => set({ accountBalance: parseFloat(v) || 0 })}
          suffix="$"
        />
        <Field
          label="Risk"
          value={String(riskPct)}
          onChange={(v) => set({ riskPct: parseFloat(v) || 0 })}
          step="0.1"
          suffix="%"
        />
        <Field
          label="Leverage"
          value={String(leverage)}
          onChange={(v) => set({ leverage: parseFloat(v) || 1 })}
          suffix="x"
        />
      </div>

      {/* Trade levels */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
            Levels ·{' '}
            <span className={direction === 'Long' ? 'text-brand-dark' : 'text-bear'}>
              {direction}
            </span>
          </span>
          {signal.risk && (
            <button
              type="button"
              onClick={resetLevels}
              className="focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-content-subtle hover:text-content"
            >
              <RotateCcw className="h-3 w-3" />
              Use setup
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Entry" value={entry} onChange={setEntry} />
          <Field label="Stop" value={stop} onChange={setStop} />
          <Field label="Target" value={tp} onChange={setTp} />
        </div>
      </div>

      {/* Results */}
      {valid ? (
        <div className="rounded-xl bg-surface-muted p-3">
          <div className="grid grid-cols-2 gap-x-4">
            <Row label="Risk" value={`$${money(riskAmount)}`} accent="text-bear" />
            <Row
              label="Reward"
              value={rr ? `$${money(rewardAmount)}` : '—'}
              accent="text-brand-dark"
            />
            <Row label="Risk : Reward" value={rr ? `1 : ${rr.toFixed(2)}` : '—'} />
            <Row label={meta.lotLabel} value={num(lots, 3)} />
            <Row label="Position size" value={`${num(units)} u`} />
            <Row label="Stop distance" value={meta.pip > 0 ? `${num(slPips, 1)} ${meta.pipLabel}` : `${distPct.toFixed(2)}%`} />
            <Row label="Notional" value={`$${money(notional)}`} />
            <Row label="Margin" value={`$${money(margin)}`} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-surface-muted p-3 text-sm text-content-muted">
          Enter an entry and stop to size the position.
        </p>
      )}

      <p className="text-[11px] text-content-subtle">
        Sized to risk {riskPct}% of ${money(accountBalance)}. Lots use a{' '}
        {meta.contract.toLocaleString()}-unit contract. Educational, not financial advice.
      </p>
    </div>
  );
}
