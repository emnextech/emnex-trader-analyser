import { useState } from 'react';
import { ChevronsUpDown, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useChartStore } from '../store/chartStore';
import { useCandles, useSymbols } from '../hooks/useMarketData';
import { ChartPanel } from '../components/chart/ChartPanel';
import { TimeframeSelector } from '../components/chart/TimeframeSelector';
import { DrawingsPanel } from '../components/chart/DrawingsPanel';
import { SymbolModal } from '../components/chart/SymbolModal';
import { AnalysisPanel } from '../components/analysis/AnalysisPanel';

function Divider() {
  return <span className="hidden h-7 w-px bg-line sm:block" />;
}

function SymbolButton({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  const { data: symbols } = useSymbols();
  const meta = symbols?.find((s) => s.symbol === symbol);
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring group flex items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-1.5 hover:border-content-subtle"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-xs font-bold text-white">
        {symbol.slice(0, 2)}
      </span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-bold tracking-[-0.01em] text-content">{symbol}</span>
        <span className="block text-xs text-content-muted">{meta?.name ?? 'Select market'}</span>
      </span>
      <ChevronsUpDown className="ml-1 h-4 w-4 text-content-subtle group-hover:text-content" />
    </button>
  );
}

function PriceCluster({ symbol, interval }: { symbol: string; interval: string }) {
  const { data: candles } = useCandles(symbol, interval);
  const last = candles?.at(-1);
  const prev = candles?.at(-2);
  const change = last && prev ? last.close - prev.close : 0;
  const changePct = last && prev && prev.close ? (change / prev.close) * 100 : 0;
  const up = change >= 0;

  if (!last) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-xl font-bold leading-none text-content">
        {last.close.toLocaleString(undefined, { maximumFractionDigits: 5 })}
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
          up ? 'bg-brand/10 text-brand-dark' : 'bg-bear/10 text-bear'
        }`}
      >
        {up ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
      </span>
    </div>
  );
}

export function Dashboard() {
  const { symbol, timeframe, drawings, setSymbol, setTimeframe, toggleDrawing } = useChartStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-white px-3 py-2">
        <div className="flex items-center gap-3">
          <SymbolButton symbol={symbol} onClick={() => setPickerOpen(true)} />
          <Divider />
          <PriceCluster symbol={symbol} interval={timeframe} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <Divider />
          <DrawingsPanel value={drawings} onToggle={toggleDrawing} />
          <Divider />
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            title="Toggle AI analysis"
            className={`focus-ring inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-sm font-semibold transition ${
              panelOpen
                ? 'border-brand bg-brand/10 text-brand-dark'
                : 'border-line text-content-muted hover:text-content'
            }`}
          >
            {panelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
            <span className="hidden md:inline">Analysis</span>
          </button>
        </div>
      </div>

      {/* Chart + analysis sidebar */}
      <div className="relative flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 bg-white">
          <ChartPanel symbol={symbol} interval={timeframe} drawings={drawings} />
        </div>

        {panelOpen && (
          <div className="shrink-0 border-l border-line bg-white max-lg:absolute max-lg:bottom-0 max-lg:right-0 max-lg:top-0 max-lg:z-30 max-lg:w-[90%] max-lg:max-w-sm max-lg:shadow-soft lg:w-[348px]">
            <AnalysisPanel symbol={symbol} interval={timeframe} onClose={() => setPanelOpen(false)} />
          </div>
        )}
      </div>

      <SymbolModal
        open={pickerOpen}
        value={symbol}
        onChange={setSymbol}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
