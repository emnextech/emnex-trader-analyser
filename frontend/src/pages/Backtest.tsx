import { useMemo, useState } from 'react';
import { History, Play, TrendingUp, TrendingDown } from 'lucide-react';
import { useBacktest } from '../hooks/useStructure';
import { useSymbols } from '../hooks/useMarketData';
import { useChartStore } from '../store/chartStore';
import { TimeframeSelector } from '../components/chart/TimeframeSelector';
import { Spinner } from '../components/ui/Spinner';
import type { BacktestResponse, BacktestTrade, EquityPoint } from '../types/analysis';
import type { Timeframe } from '../types/market';

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
        {label}
      </div>
      <div className={`mt-1 font-display text-xl font-bold tabular-nums ${accent ?? 'text-content'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-content-subtle">{hint}</div>}
    </div>
  );
}

/** Dependency-free SVG equity curve, baseline = starting balance. */
function EquityCurve({ points, start }: { points: EquityPoint[]; start: number }) {
  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const W = 800;
    const H = 220;
    const pad = 6;
    const vals = points.map((p) => p.balance);
    const min = Math.min(...vals, start);
    const max = Math.max(...vals, start);
    const span = max - min || 1;
    const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
    const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);

    const line = points.map((p, i) => `${x(i)},${y(p.balance)}`).join(' ');
    const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
    const baseY = y(start);
    const up = points[points.length - 1].balance >= start;
    return { W, H, line, area, baseY, up };
  }, [points, start]);

  if (!geo) {
    return (
      <p className="grid h-40 place-items-center text-sm text-content-muted">
        Not enough trades to plot an equity curve.
      </p>
    );
  }

  const color = geo.up ? '#20AA6E' : '#E5484D';
  return (
    <svg viewBox={`0 0 ${geo.W} ${geo.H}`} className="h-56 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Starting-balance baseline */}
      <line
        x1="0"
        y1={geo.baseY}
        x2={geo.W}
        y2={geo.baseY}
        stroke="#C7CDD6"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <polygon points={geo.area} fill="url(#eqfill)" />
      <polyline
        points={geo.line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

const OUTCOME_CLS: Record<BacktestTrade['outcome'], string> = {
  win: 'bg-brand/10 text-brand-dark',
  loss: 'bg-bear/10 text-bear',
  timeout: 'bg-surface-sunken text-content-muted',
};

function Results({ data }: { data: BacktestResponse }) {
  const s = data.stats;
  const recent = [...data.trades].reverse().slice(0, 40);

  return (
    <div className="space-y-5">
      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Net return"
          value={`${s.total_return_pct >= 0 ? '+' : ''}${s.total_return_pct}%`}
          accent={s.total_return_pct >= 0 ? 'text-brand-dark' : 'text-bear'}
          hint={`$${money(data.account_balance)} → $${money(s.final_balance)}`}
        />
        <StatCard
          label="Win rate"
          value={`${s.win_rate}%`}
          hint={`${s.wins}W / ${s.losses}L`}
        />
        <StatCard
          label="Profit factor"
          value={s.profit_factor != null ? s.profit_factor.toFixed(2) : '—'}
          accent={
            s.profit_factor != null && s.profit_factor >= 1 ? 'text-brand-dark' : 'text-bear'
          }
          hint="Gross win / gross loss"
        />
        <StatCard
          label="Expectancy"
          value={`${s.expectancy_r >= 0 ? '+' : ''}${s.expectancy_r}R`}
          accent={s.expectancy_r >= 0 ? 'text-brand-dark' : 'text-bear'}
          hint="Avg result per trade"
        />
        <StatCard label="Trades" value={String(s.total_trades)} hint={`${data.candles_tested} candles`} />
        <StatCard label="Max drawdown" value={`-${s.max_drawdown_pct}%`} accent="text-bear" />
        <StatCard label="Avg planned R:R" value={`1:${s.avg_rr}`} />
        <StatCard
          label="Avg win / loss"
          value={`+${s.avg_win_r} / ${s.avg_loss_r}`}
          hint="in R units"
        />
      </div>

      {/* Equity curve */}
      <div className="panel-muted p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-content">Equity curve</h3>
          <span className="text-xs text-content-subtle">
            compounding {data.risk_pct}% risk · dashed = start
          </span>
        </div>
        <EquityCurve points={data.equity_curve} start={data.account_balance} />
      </div>

      {/* Trades */}
      {s.total_trades === 0 ? (
        <p className="rounded-xl border border-line bg-white p-4 text-sm text-content-muted">
          No trades met the ≥{data.min_confidence}% confidence threshold on this history. Try a
          lower threshold or a different timeframe.
        </p>
      ) : (
        <div className="panel-muted overflow-hidden shadow-card">
          <div className="border-b border-line px-4 py-2.5 text-sm font-bold text-content">
            Trades <span className="text-content-subtle">(latest {recent.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-content-subtle">
                  <th className="px-4 py-2.5 font-bold">Date</th>
                  <th className="px-4 py-2.5 font-bold">Side</th>
                  <th className="px-4 py-2.5 font-bold">Result</th>
                  <th className="hidden px-4 py-2.5 font-bold sm:table-cell">Conf.</th>
                  <th className="px-4 py-2.5 text-right font-bold">R</th>
                  <th className="px-4 py-2.5 text-right font-bold">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t, i) => (
                  <tr key={i} className="border-b border-line/60 bg-white/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-content-muted">
                      {new Date(t.entry_time * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          t.direction === 'long' ? 'text-brand-dark' : 'text-bear'
                        }`}
                      >
                        {t.direction === 'long' ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${OUTCOME_CLS[t.outcome]}`}>
                        {t.outcome}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 tabular-nums text-content-muted sm:table-cell">
                      {t.confidence}%
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        t.r_multiple >= 0 ? 'text-brand-dark' : 'text-bear'
                      }`}
                    >
                      {t.r_multiple >= 0 ? '+' : ''}
                      {t.r_multiple}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                        t.pnl >= 0 ? 'text-brand-dark' : 'text-bear'
                      }`}
                    >
                      {t.pnl >= 0 ? '+' : ''}${money(Math.abs(t.pnl))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function Backtest() {
  const defaultSymbol = useChartStore((s) => s.symbol);
  const { data: symbols } = useSymbols();
  const bt = useBacktest();

  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [balance, setBalance] = useState('10000');
  const [risk, setRisk] = useState('1');
  const [minConf, setMinConf] = useState('65');
  const [limit, setLimit] = useState('600');

  const run = () => {
    bt.mutate({
      symbol,
      interval: timeframe,
      account_balance: parseFloat(balance) || 10000,
      risk_pct: parseFloat(risk) || 1,
      min_confidence: parseInt(minConf) || 0,
      limit: parseInt(limit) || 600,
    });
  };

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="orb-accent h-9 w-9">
          <History className="h-5 w-5" />
        </span>
        <div>
          <h1 className="display text-2xl">Backtesting</h1>
          <p className="text-sm text-content-muted">
            Replay the decision engine across historical candles — no lookahead, pessimistic fills.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="panel-muted mb-5 p-4 shadow-card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <label className="col-span-2 block sm:col-span-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
              Market
            </span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="focus-ring w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-content"
            >
              {(symbols ?? []).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name}
                </option>
              ))}
            </select>
          </label>

          <Num label="Balance $" value={balance} onChange={setBalance} />
          <Num label="Risk %" value={risk} onChange={setRisk} step="0.1" />
          <Num label="Min conf %" value={minConf} onChange={setMinConf} />
          <Num label="Candles" value={limit} onChange={setLimit} />

          <div className="col-span-2 flex flex-col sm:col-span-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
              &nbsp;
            </span>
            <button
              type="button"
              onClick={run}
              disabled={bt.isPending}
              className="btn-primary !min-h-[38px] w-full text-sm disabled:opacity-60"
            >
              {bt.isPending ? (
                <Spinner size={16} />
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      {/* Body */}
      {bt.isPending ? (
        <div className="grid place-items-center py-16">
          <Spinner size={28} label={`Backtesting ${symbol} · ${timeframe}…`} />
        </div>
      ) : bt.isError ? (
        <p className="rounded-xl border border-bear/30 bg-bear/5 p-4 text-sm text-bear">
          {(bt.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            'Backtest failed. Is the backend running?'}
        </p>
      ) : bt.data ? (
        <Results data={bt.data} />
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white/50 p-10 text-center">
          <History className="mx-auto h-8 w-8 text-content-subtle" />
          <p className="mt-3 text-sm text-content-muted">
            Pick a market and timeframe, then <span className="font-semibold text-content">Run</span> to
            simulate how the engine would have traded it.
          </p>
        </div>
      )}

      <p className="mt-5 text-xs text-content-subtle">
        Simulation only — single position at a time, {`≥`}min-confidence entries, stop/target from the
        risk plan, worst-case fills when a bar spans both. Zone confluence is excluded for speed, so
        live signals may differ slightly. Past performance is not indicative of future results.
        Educational, not financial advice.
      </p>
    </div>
  );
}

function Num({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-content-subtle">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-content"
      />
    </label>
  );
}
