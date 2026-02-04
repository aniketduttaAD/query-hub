import { create } from 'zustand';
import type { DatabaseType, ValidationError } from '../types';

interface QueryState {
  currentQuery: string;
  language: DatabaseType;
  isExecuting: boolean;
  validationErrors: ValidationError[];

  setQuery: (query: string) => void;
  setLanguage: (language: DatabaseType) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  clearQuery: () => void;
}

const DEFAULT_SQL_QUERY = `SELECT * FROM your_table LIMIT 10;`;

const DEFAULT_MONGO_QUERY = `db.collection.find({}).limit(10)`;

export const useQueryStore = create<QueryState>((set, get) => ({
  currentQuery: DEFAULT_SQL_QUERY,
  language: 'postgresql',
  isExecuting: false,
  validationErrors: [],

  setQuery: (query) => set({ currentQuery: query }),

  setLanguage: (language) => {
    const { currentQuery } = get();
    const isDefault = currentQuery === DEFAULT_SQL_QUERY || currentQuery === DEFAULT_MONGO_QUERY;

    set({
      language,
      currentQuery: isDefault
        ? language === 'postgresql'
          ? DEFAULT_SQL_QUERY
          : DEFAULT_MONGO_QUERY
        : currentQuery,
      validationErrors: [],
    });
  },

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),

  clearQuery: () => {
    const { language } = get();
    set({
      currentQuery: language === 'postgresql' ? DEFAULT_SQL_QUERY : DEFAULT_MONGO_QUERY,
      validationErrors: [],
    });
  },
}));
