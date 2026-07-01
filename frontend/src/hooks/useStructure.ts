import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  BacktestResponse,
  MentorResponse,
  ScanResponse,
  SignalResponse,
  StructureResponse,
} from '../types/analysis';

export interface BacktestParams {
  symbol: string;
  interval: string;
  account_balance: number;
  risk_pct: number;
  min_confidence: number;
  limit: number;
}

/** On-demand backtest — run via `mutate(params)` from a button. */
export function useBacktest() {
  return useMutation({
    mutationFn: async (params: BacktestParams) => {
      const { data } = await api.get<BacktestResponse>('/api/analysis/backtest', {
        params,
        timeout: 120_000,
      });
      return data;
    },
  });
}

export function useStructure(symbol: string, interval: string, enabled = true) {
  return useQuery({
    queryKey: ['structure', symbol, interval],
    queryFn: async () => {
      const { data } = await api.get<StructureResponse>('/api/analysis/structure', {
        params: { symbol, interval, limit: 400 },
      });
      return data;
    },
    enabled: enabled && Boolean(symbol && interval),
    staleTime: 30_000,
  });
}

export function useSignal(symbol: string, interval: string, enabled = true) {
  return useQuery({
    queryKey: ['signal', symbol, interval],
    queryFn: async () => {
      const { data } = await api.get<SignalResponse>('/api/analysis/signal', {
        params: { symbol, interval },
      });
      return data;
    },
    enabled: enabled && Boolean(symbol && interval),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useScan(interval: string, refetchMs?: number) {
  return useQuery({
    queryKey: ['scan', interval],
    queryFn: async () => {
      const { data } = await api.get<ScanResponse>('/api/analysis/scan', {
        params: { interval },
      });
      return data;
    },
    staleTime: 30_000,
    refetchInterval: refetchMs,
    refetchOnWindowFocus: false,
  });
}

/** On-demand AI mentor explanation. Enable only when the user requests it. */
export function useMentor(symbol: string, interval: string, enabled: boolean) {
  return useQuery({
    queryKey: ['mentor', symbol, interval],
    queryFn: async () => {
      const { data } = await api.get<MentorResponse>('/api/analysis/mentor', {
        params: { symbol, interval },
      });
      return data;
    },
    enabled: enabled && Boolean(symbol && interval),
    staleTime: 120_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  });
}
