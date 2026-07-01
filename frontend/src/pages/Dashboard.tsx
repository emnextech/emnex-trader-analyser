import { useChartStore } from '../store/chartStore';
import { useCandles, useSymbols } from '../hooks/useMarketData';
import { ChartPanel } from '../components/chart/ChartPanel';
import { TimeframeSelector } from '../components/chart/TimeframeSelector';
import { SymbolSelector } from '../components/chart/SymbolSelector';

function PriceHeader({ symbol, interval }: { symbol: string; interval: string }) {
  const { data: candles } = useCandles(symbol, interval);
  const { data: symbols } = useSymbols();
  const meta = symbols?.find((s) => s.symbol === symbol);

  const last = candles?.at(-1);
  const prev = candles?.at(-2);
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev && prev.close ? (change / prev.close) * 100 : 0;
  const up = change >= 0;

  return (
    <div className="flex items-baseline gap-3">
      <div>
        <p className="eyebrow text-content-subtle">{meta?.type ?? 'market'}</p>
        <h1 className="display text-2xl text-content sm:text-3xl">{meta?.name ?? symbol}</h1>
      </div>
      {last && (
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold text-content">
            {last.close.toLocaleString(undefined, { maximumFractionDigits: 5 })}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              up ? 'bg-brand/10 text-brand-dark' : 'bg-bear/10 text-bear'
            }`}
          >
            {up ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { symbol, timeframe, setSymbol, setTimeframe } = useChartStore();

  return (
    <div className="container-page py-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PriceHeader symbol={symbol} interval={timeframe} />
        <div className="flex flex-wrap items-center gap-3">
          <SymbolSelector value={symbol} onChange={setSymbol} />
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      <div className="panel-muted p-2 shadow-card sm:p-3">
        <div className="h-[68vh] min-h-[420px] w-full overflow-hidden rounded-[1.6rem] bg-white">
          <ChartPanel symbol={symbol} interval={timeframe} />
        </div>
      </div>

      <p className="mt-4 text-sm text-content-subtle">
        Live candles stream automatically — crypto in real time via Binance, other markets polled
        from Yahoo Finance. Analysis engines (structure, drawing, decision, AI mentor) arrive in
        later phases.
      </p>
    </div>
  );
}
