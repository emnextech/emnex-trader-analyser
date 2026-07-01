export type Trend = 'bullish' | 'bearish' | 'ranging';
export type Phase = 'compression' | 'expansion' | 'normal';

export interface SwingPoint {
  time: number;
  price: number;
  kind: 'high' | 'low';
  strength: 'major' | 'minor';
  label: 'HH' | 'HL' | 'LH' | 'LL' | null;
}

export interface Level {
  price: number;
  kind: 'support' | 'resistance';
  touches: number;
  first_time: number;
  last_time: number;
}

export interface LinePoint {
  time: number;
  price: number;
}

export interface Trendline {
  start: LinePoint;
  end: LinePoint;
  kind: 'support' | 'resistance';
  touches: number;
  score: number;
}

export interface StructureEvent {
  type: 'BOS' | 'CHoCH';
  direction: 'bullish' | 'bearish';
  price: number;
  from_time: number;
  time: number;
}

export interface Liquidity {
  price: number;
  side: 'buy' | 'sell';
  touches: number;
}

export interface Zone {
  kind: 'order_block' | 'fvg';
  direction: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  start_time: number;
  end_time: number;
  mitigated: boolean;
  fresh: boolean;
  tests: number;
  strength: number;
  label: string;
}

export interface FibLevel {
  ratio: number;
  price: number;
}

export interface Fibonacci {
  high: number;
  low: number;
  direction: 'up' | 'down';
  start_time: number;
  end_time: number;
  levels: FibLevel[];
}

export interface KeyLevel {
  label: string;
  price: number;
}

export interface CandleMark {
  time: number;
  name: string;
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface StructureResponse {
  symbol: string;
  interval: string;
  trend: Trend;
  trend_strength: number;
  phase: Phase;
  swings: SwingPoint[];
  levels: Level[];
  trendlines: Trendline[];
  events: StructureEvent[];
  liquidity: Liquidity[];
  zones: Zone[];
  fibonacci: Fibonacci | null;
  key_levels: KeyLevel[];
  patterns: CandleMark[];
}

// --- Phase 4: decision / confidence / risk ---

export type Decision = 'BUY' | 'SELL' | 'WAIT' | 'NO_TRADE';

export interface CandlePattern {
  name: string;
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface DecisionScores {
  trend: number;
  structure: number;
  momentum: number;
  pattern: number;
  risk: number;
  volume: number;
}

export interface RiskPlan {
  direction: 'long' | 'short';
  entry: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: number;
  risk_pct: number;
  account_balance: number;
  position_size: number;
}

export interface SignalResponse {
  symbol: string;
  interval: string;
  decision: Decision;
  bias: Trend;
  confidence: number;
  trend: Trend;
  momentum_rsi: number | null;
  scores: DecisionScores;
  pattern: CandlePattern | null;
  risk: RiskPlan | null;
  reasons: string[];
}

export interface MentorResponse {
  symbol: string;
  interval: string;
  configured: boolean;
  explanation: string;
  decision: string | null;
  confidence: number | null;
}

export interface ScanRow {
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  decision: Decision;
  bias: Trend;
  confidence: number;
  trend: Trend;
  risk_reward: number | null;
  rsi: number | null;
}

export interface ScanResponse {
  interval: string;
  rows: ScanRow[];
}

// --- Module 17: Backtesting ---

export interface BacktestTrade {
  entry_time: number;
  exit_time: number;
  direction: 'long' | 'short';
  entry: number;
  stop_loss: number;
  take_profit: number;
  exit_price: number;
  outcome: 'win' | 'loss' | 'timeout';
  r_multiple: number;
  pnl: number;
  confidence: number;
}

export interface EquityPoint {
  time: number;
  balance: number;
}

export interface BacktestStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit_factor: number | null;
  expectancy_r: number;
  avg_win_r: number;
  avg_loss_r: number;
  avg_rr: number;
  total_return_pct: number;
  final_balance: number;
  max_drawdown_pct: number;
}

export interface BacktestResponse {
  symbol: string;
  interval: string;
  account_balance: number;
  risk_pct: number;
  min_confidence: number;
  candles_tested: number;
  stats: BacktestStats;
  trades: BacktestTrade[];
  equity_curve: EquityPoint[];
}
