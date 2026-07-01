import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  X,
  Sparkles,
  Send,
  ChevronDown,
} from 'lucide-react';
import { useSignal, useStructure } from '../../hooks/useStructure';
import { API_URL } from '../../lib/api';
import { Spinner } from '../ui/Spinner';
import { RiskCalculator } from './RiskCalculator';
import type { Decision, Trend } from '../../types/analysis';

const DECISION_STYLE: Record<Decision, { bg: string; text: string; label: string }> = {
  BUY: { bg: 'bg-brand', text: 'text-white', label: 'BUY' },
  SELL: { bg: 'bg-bear', text: 'text-white', label: 'SELL' },
  WAIT: { bg: 'bg-amber-400', text: 'text-ink', label: 'WAIT' },
  NO_TRADE: { bg: 'bg-surface-sunken', text: 'text-content', label: 'NO TRADE' },
};

function TrendBadge({ trend }: { trend: Trend }) {
  const map = {
    bullish: { icon: TrendingUp, cls: 'bg-brand/10 text-brand-dark', label: 'Bullish' },
    bearish: { icon: TrendingDown, cls: 'bg-bear/10 text-bear', label: 'Bearish' },
    ranging: { icon: Minus, cls: 'bg-surface-sunken text-content-muted', label: 'Ranging' },
  }[trend];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${map.cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? 'bg-brand' : value >= 45 ? 'bg-amber-400' : 'bg-bear';
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium text-content-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-content">
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-content-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ?? 'text-content'}`}>{value}</span>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex w-full items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wide text-content-subtle hover:text-content"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="px-4 pb-3.5">{children}</div>}
    </div>
  );
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

function MentorChat({ symbol, interval }: { symbol: string; interval: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset the conversation whenever the market or timeframe changes.
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [symbol, interval]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;

    const history: ChatMsg[] = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const resp = await fetch(`${API_URL}/api/analysis/mentor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, interval, messages: history }),
      });
      if (!resp.body) throw new Error('no stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: 'assistant', content: acc };
          return copy;
        });
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: 'Failed to reach the AI mentor. Is the backend running?',
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <Section title="AI Mentor">
      {messages.length === 0 ? (
        <button
          type="button"
          onClick={() => send('Explain this setup for me.')}
          className="btn-primary w-full !min-h-[44px] text-sm"
        >
          <Sparkles className="h-4 w-4" />
          Explain this setup
        </button>
      ) : (
        <div className="space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-[92%] rounded-2xl px-3 py-2 text-left text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-ink text-white'
                    : 'whitespace-pre-wrap bg-surface-muted text-content'
                }`}
              >
                {m.content || (streaming ? '…' : '')}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up…"
          className="auth-input !py-2 text-sm"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="orb-accent h-9 w-9 shrink-0 disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Section>
  );
}

interface Props {
  symbol: string;
  interval: string;
  onClose: () => void;
}

export function AnalysisPanel({ symbol, interval, onClose }: Props) {
  const { data: signal, isLoading } = useSignal(symbol, interval);
  const { data: structure } = useStructure(symbol, interval);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand" />
          <h2 className="font-display text-sm font-bold tracking-[-0.01em]">AI Analysis</h2>
          <span className="tag">{symbol} · {interval}</span>
        </div>
        <button
          onClick={onClose}
          className="focus-ring rounded-full p-1 text-content-subtle hover:bg-surface-muted hover:text-content lg:hidden"
          aria-label="Close analysis"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading && !signal ? (
        <div className="grid place-items-center px-4 py-10">
          <Spinner size={24} label={`Analysing ${symbol}…`} />
        </div>
      ) : signal ? (
        <>
          {/* Decision */}
          <div className="px-4 pb-4">
            <div className={`rounded-2xl p-4 ${DECISION_STYLE[signal.decision].bg}`}>
              <div className="flex items-center justify-between">
                <span className={`font-display text-2xl font-bold ${DECISION_STYLE[signal.decision].text}`}>
                  {DECISION_STYLE[signal.decision].label}
                </span>
                <span className={`text-sm font-semibold ${DECISION_STYLE[signal.decision].text}`}>
                  {signal.confidence}% confidence
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/15">
                <div
                  className="h-full rounded-full bg-white/90"
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
            </div>
          </div>

          <MentorChat symbol={symbol} interval={interval} />

          {/* Market context */}
          <Section title="Market structure">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TrendBadge trend={signal.trend} />
              {structure && (
                <span className="tag capitalize">{structure.phase}</span>
              )}
            </div>
            {structure && (
              <ScoreBar label="Strength" value={structure.trend_strength} />
            )}
            <div className="mt-2">
              <Stat label="Momentum (RSI)" value={signal.momentum_rsi?.toString() ?? '—'} />
              <Stat label="Candle pattern" value={signal.pattern?.name ?? 'None'} />
              {structure && (
                <Stat label="BOS / CHoCH" value={`${structure.events.length} events`} />
              )}
            </div>
          </Section>

          {/* Confidence breakdown */}
          <Section title="Confidence breakdown">
            <div className="space-y-1.5">
              <ScoreBar label="Trend" value={signal.scores.trend} />
              <ScoreBar label="Structure" value={signal.scores.structure} />
              <ScoreBar label="Momentum" value={signal.scores.momentum} />
              <ScoreBar label="Pattern" value={signal.scores.pattern} />
              <ScoreBar label="Risk" value={signal.scores.risk} />
              <ScoreBar label="Volume" value={signal.scores.volume} />
            </div>
          </Section>

          {/* Risk calculator (MetaTrader-style position sizing) */}
          <Section title="Risk calculator">
            <RiskCalculator symbol={symbol} signal={signal} />
          </Section>

          {/* Reasons */}
          <Section title="Why this call">
            <ul className="space-y-2">
              {signal.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-content-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          <p className="px-4 py-3 text-xs text-content-subtle">
            Educational analysis, not financial advice.
          </p>
        </>
      ) : (
        <p className="px-4 py-8 text-sm text-bear">Analysis unavailable for {symbol}.</p>
      )}
    </aside>
  );
}
