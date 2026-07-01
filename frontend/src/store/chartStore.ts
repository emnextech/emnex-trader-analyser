import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Timeframe } from '../types/market';

export interface DrawingToggles {
  swings: boolean;
  levels: boolean;
  trendlines: boolean;
  structure: boolean;
  zones: boolean;
  fib: boolean;
  keyLevels: boolean;
  patterns: boolean;
}

interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  drawings: DrawingToggles;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: Timeframe) => void;
  toggleDrawing: (key: keyof DrawingToggles) => void;
}

// Only the trend (trendlines) is on by default — a clean chart to start.
const DEFAULT_DRAWINGS: DrawingToggles = {
  swings: false,
  levels: false,
  trendlines: true,
  structure: false,
  zones: false,
  fib: false,
  keyLevels: false,
  patterns: false,
};

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      drawings: DEFAULT_DRAWINGS,
      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      toggleDrawing: (key) =>
        set((s) => ({ drawings: { ...s.drawings, [key]: !s.drawings[key] } })),
    }),
    {
      name: 'emnex-chart',
      partialize: (s) => ({
        symbol: s.symbol,
        timeframe: s.timeframe,
        drawings: s.drawings,
      }),
    },
  ),
);
