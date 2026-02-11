import { useState, useMemo } from 'react';
import { History, Trash2, Search, Database } from 'lucide-react';
import { Button, Input } from '../common';
import { HistoryItem } from './HistoryItem';
import { useHistoryStore, useQueryStore } from '../../stores';
import type { HistoryEntry, DatabaseType } from '../../types';

export function CommandHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<DatabaseType | 'all'>('all');
  const { entries, removeEntry, clearHistory, getEntriesByType } = useHistoryStore();
  const { setQuery, setLanguage } = useQueryStore();

  const handleRerun = (entry: HistoryEntry) => {
    setQuery(entry.query);
    if (entry.language) {
      setLanguage(entry.language);
    }
  };

  const handleDelete = (id: string) => {
    removeEntry(id);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      clearHistory();
    }
  };

  const typeFilteredEntries = useMemo(() => {
    if (selectedType === 'all') return entries;
    return getEntriesByType(selectedType);
  }, [entries, selectedType, getEntriesByType]);

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return typeFilteredEntries;
    return typeFilteredEntries.filter(
      (e) =>
        e.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.connectionName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [typeFilteredEntries, searchTerm]);

  const entriesByDate = useMemo(() => {
    return filteredEntries.reduce(
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
  }, [filteredEntries]);

  const mongoCount = useMemo(() => getEntriesByType('mongodb').length, [getEntriesByType]);
  const postgresCount = useMemo(() => getEntriesByType('postgresql').length, [getEntriesByType]);

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <History className="w-12 h-12 text-text-muted mb-3 opacity-40" />
        <p className="text-sm text-text-secondary">No command history</p>
        <p className="text-xs text-text-muted mt-1">Run queries to build your history</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-2 sm:p-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h4 className="text-sm font-semibold text-primary truncate">History</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-error hover:text-error shrink-0"
            title="Clear all history"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 overflow-x-auto pb-1">
          <Button
            variant={selectedType === 'all' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('all')}
            className="text-xs shrink-0"
          >
            All ({entries.length})
          </Button>
          <Button
            variant={selectedType === 'mongodb' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('mongodb')}
            className="text-xs shrink-0"
          >
            MongoDB ({mongoCount})
          </Button>
          <Button
            variant={selectedType === 'postgresql' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedType('postgresql')}
            className="text-xs shrink-0"
          >
            PostgreSQL ({postgresCount})
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search history..."
            className="pl-8 w-full min-w-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 sm:p-3 min-h-0">
        {Object.keys(entriesByDate).length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">
            No matching entries found
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(entriesByDate).map(([date, dateEntries]) => (
              <div key={date}>
                <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  {date}
                </h5>
                <div className="space-y-2">
                  {dateEntries.map((entry) => (
                    <HistoryItem
                      key={entry.id}
                      entry={entry}
                      onRerun={handleRerun}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 sm:p-3 border-t border-border bg-surface-hover shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <p className="text-xs text-text-muted">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'query' : 'queries'} shown
          </p>
          <p className="text-xs text-text-muted flex items-center gap-1">
            <Database className="w-3 h-3 shrink-0" />
            History retained for 2 days
          </p>
        </div>
      </div>
    </div>
  );
}
