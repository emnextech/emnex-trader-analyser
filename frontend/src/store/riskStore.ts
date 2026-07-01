import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RiskState {
  accountBalance: number;
  riskPct: number;
  leverage: number;
  set: (patch: Partial<Pick<RiskState, 'accountBalance' | 'riskPct' | 'leverage'>>) => void;
}

export const useRiskStore = create<RiskState>()(
  persist(
    (set) => ({
      accountBalance: 10000,
      riskPct: 1,
      leverage: 100,
      set: (patch) => set(patch),
    }),
    { name: 'emnex-risk' },
  ),
);
