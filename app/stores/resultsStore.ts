import { create } from 'zustand';
import type { QueryResult } from '../types';

type ViewMode = 'table' | 'json';

interface ResultsState {
  results: QueryResult | null;
  isLoading: boolean;
  viewMode: ViewMode;

  setResults: (results: QueryResult | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  clearResults: () => void;
}

export const useResultsStore = create<ResultsState>((set) => ({
  results: null,
  isLoading: false,
  viewMode: 'table',

  setResults: (results) => set({ results, isLoading: false }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setViewMode: (viewMode) => set({ viewMode }),

  clearResults: () => set({ results: null, isLoading: false }),
}));
