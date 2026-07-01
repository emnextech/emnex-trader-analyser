import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, RefreshCw, Radar } from 'lucide-react';
import { useScan } from '../hooks/useStructure';
import { useChartStore } from '../store/chartStore';
import { api } from '../lib/api';
import { TimeframeSelector } from '../components/chart/TimeframeSelector';
import { Spinner } from '../components/ui/Spinner';
import type { Decision, ScanRow } from '../types/analysis';
import type { Timeframe } from '../types/market';

const DECISION_CLS: Record<Decision, string> = {
  BUY: 'bg-brand text-white',
  SELL: 'bg-bear text-white',
  WAIT: 'bg-amber-400 text-ink',
  NO_TRADE: 'bg-surface-sunken text-content-muted',
};

const ALERT_THRESHOLD = 70;

export function Scanner() {
  const navigate = useNavigate();
  const setSymbol = useChartStore((s) => s.setSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [alertsOn, setAlertsOn] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const alerted = useRef<Set<string>>(new Set());

  const { data, isFetching, refetch } = useScan(timeframe, alertsOn ? 60_000 : undefined);

  // Reset the alert dedupe set when the timeframe changes.
  useEffect(() => {
    alerted.current = new Set();
  }, [timeframe]);

  async function enableAlerts() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    setAlertsOn(true);
  }

  function pushToast(text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }

  // Fire notifications for fresh high-confidence actionable setups.
  useEffect(() => {
    if (!alertsOn || !data) return;
    for (const r of data.rows) {
      const actionable = r.decision === 'BUY' || r.decision === 'SELL';
      if (!actionable || r.confidence < ALERT_THRESHOLD) continue;
      const key = `${r.symbol}:${r.decision}:${timeframe}`;
      if (alerted.current.has(key)) continue;
      alerted.current.add(key);

      const title = `${r.decision} ${r.symbol} (${timeframe})`;
      const body = `${r.confidence}% confidence · ${r.trend}${
        r.risk_reward ? ` · R:R ${r.risk_reward}` : ''
      }`;
      pushToast(`${title} — ${body}`);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      // Fan out to Discord/Telegram if the backend has them configured.
      api.post('/api/notifications/alert', { title, message: body }).catch(() => {});
    }
  }, [data, alertsOn, timeframe]);

  const openChart = (r: ScanRow) => {
    setSymbol(r.symbol);
    navigate('/');
  };

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="orb-accent h-9 w-9">
            <Radar className="h-5 w-5" />
          </span>
          <div>
            <h1 className="display text-2xl">Market Scanner</h1>
            <p className="text-sm text-content-muted">
              Every market ranked by the decision engine — actionable setups first.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-content hover:border-content-subtle disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => (alertsOn ? setAlertsOn(false) : enableAlerts())}
            className={`focus-ring inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
              alertsOn
                ? 'border-brand bg-brand/10 text-brand-dark'
                : 'border-line text-content-muted hover:text-content'
            }`}
          >
            {alertsOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Alerts {alertsOn ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div className="panel-muted overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-content-subtle">
                <th className="px-4 py-3 font-bold">Market</th>
                <th className="px-4 py-3 font-bold">Signal</th>
                <th className="px-4 py-3 font-bold">Confidence</th>
                <th className="hidden px-4 py-3 font-bold sm:table-cell">Trend</th>
                <th className="hidden px-4 py-3 font-bold md:table-cell">R:R</th>
                <th className="px-4 py-3 text-right font-bold">Price</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r) => (
                <tr
                  key={r.symbol}
                  onClick={() => openChart(r)}
                  className="cursor-pointer border-b border-line/60 bg-white/40 transition hover:bg-white"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-content">{r.symbol}</div>
                    <div className="text-xs text-content-muted">
                      {r.name} · {r.type}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${DECISION_CLS[r.decision]}`}
                    >
                      {r.decision.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={`h-full rounded-full ${
                            r.confidence >= 70 ? 'bg-brand' : r.confidence >= 50 ? 'bg-amber-400' : 'bg-bear'
                          }`}
                          style={{ width: `${r.confidence}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-content-muted">{r.confidence}%</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-content-muted sm:table-cell">
                    {r.trend}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-content-muted md:table-cell">
                    {r.risk_reward ? `1:${r.risk_reward}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-content">
                    {r.price != null
                      ? r.price.toLocaleString(undefined, { maximumFractionDigits: 5 })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isFetching && !data && (
          <div className="grid place-items-center px-4 py-10">
            <Spinner size={26} label="Scanning markets…" />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-content-subtle">
        Alerts fire for fresh BUY/SELL setups at ≥{ALERT_THRESHOLD}% confidence (desktop
        notification + optional Discord/Telegram if configured in the backend). Educational, not
        financial advice.
      </p>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-content shadow-soft"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand" />
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
