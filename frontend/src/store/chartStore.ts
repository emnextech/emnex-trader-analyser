import { create } from 'zustand';
import type { Timeframe } from '../types/market';

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
}

export const useChartStore = create<ChartState>((set) => ({
  // Crypto default — always-on market with genuine live WebSocket data.
  symbol: 'BTCUSDT',
  timeframe: '1h',
  setSymbol: (symbol) => set({ symbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
}));
