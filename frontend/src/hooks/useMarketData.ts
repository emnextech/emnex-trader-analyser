import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CandlesResponse, MarketSymbol } from '../types/market';

export function useSymbols() {
  return useQuery({
    queryKey: ['symbols'],
    queryFn: async () => {
      const { data } = await api.get<MarketSymbol[]>('/api/markets/symbols');
      return data;
    },
    staleTime: Infinity,
  });
}

export function useCandles(symbol: string, interval: string, limit = 500) {
  return useQuery({
    queryKey: ['candles', symbol, interval, limit],
    queryFn: async () => {
      const { data } = await api.get<CandlesResponse>('/api/markets/candles', {
        params: { symbol, interval, limit },
      });
      return data.candles;
    },
    enabled: Boolean(symbol && interval),
  });
}
