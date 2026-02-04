import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HistoryEntry, DatabaseType } from '../types';
import { createIndexedDbStorage } from '../services/indexedDbStorage';
import { logger } from '../../lib/logger';
import { HISTORY_MAX_ENTRIES, HISTORY_RETENTION_MS } from '../../lib/config/constants';

interface HistoryState {
  entries: HistoryEntry[];

  addEntry: (entry: Omit<HistoryEntry, 'id' | 'executedAt'>) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
  getEntriesByDate: () => Record<string, HistoryEntry[]>;
  getEntriesByType: (type: DatabaseType) => HistoryEntry[];
  cleanupOldEntries: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => {
      const cleanupOldEntries = () => {
        try {
          const state = get();
          if (!state || !state.entries) return;

          const now = Date.now();
          const filtered = state.entries.filter(
            (entry) => now - entry.executedAt < HISTORY_RETENTION_MS,
          );
          if (filtered.length !== state.entries.length) {
            set({ entries: filtered });
          }
        } catch (error) {
          logger.warn('History cleanup failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      return {
        entries: [],

        addEntry: (entry) => {
          cleanupOldEntries();

          const newEntry: HistoryEntry = {
            ...entry,
            id: crypto.randomUUID(),
            executedAt: Date.now(),
          };
          set((state) => {
            const updated = [newEntry, ...state.entries].slice(0, HISTORY_MAX_ENTRIES);
            return { entries: updated };
          });
        },

        removeEntry: (id) => {
          set((state) => ({
            entries: state.entries.filter((e) => e.id !== id),
          }));
        },

        clearHistory: () => {
          set({ entries: [] });
        },

        getEntriesByDate: () => {
          cleanupOldEntries();
          const { entries } = get();
          return entries.reduce(
            (acc, entry) => {
              const dateKey = new Date(entry.executedAt).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(entry);
              return acc;
            },
            {} as Record<string, HistoryEntry[]>,
          );
        },

        getEntriesByType: (type: DatabaseType) => {
          cleanupOldEntries();
          const { entries } = get();
          return entries.filter((entry) => entry.language === type);
        },

        cleanupOldEntries,
      };
    },
    {
      name: 'db-playground-history',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.cleanupOldEntries();
        }
      },
      storage: createJSONStorage(() => createIndexedDbStorage('queryhub')),
    },
  ),
);
