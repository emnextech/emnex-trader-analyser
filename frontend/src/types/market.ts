export interface Candle {
  time: number; // UNIX epoch seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type MarketType = 'crypto' | 'forex' | 'commodity' | 'index' | 'stock';

export interface MarketSymbol {
  symbol: string;
  name: string;
  type: MarketType;
  provider: 'binance' | 'yahoo';
}

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' | '1M';

export interface CandlesResponse {
  symbol: string;
  interval: string;
  candles: Candle[];
}
