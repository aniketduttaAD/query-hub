import { create } from 'zustand';
import type { TransactionState } from '../types';

interface TransactionStore extends TransactionState {
  setActive: (active: boolean) => void;
  addQuery: (query: string) => void;
  clear: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  active: false,
  queries: [],
  setActive: (active) => set({ active }),
  addQuery: (query) =>
    set((state) => ({
      queries: [...state.queries, query],
    })),
  clear: () => set({ active: false, queries: [] }),
}));
