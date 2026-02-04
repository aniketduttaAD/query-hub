import { Play, Trash2, CheckCircle, XCircle, Clock, Database, Table } from 'lucide-react';
import { Button } from '../common';
import type { HistoryEntry } from '../../types';

interface HistoryItemProps {
  entry: HistoryEntry;
  onRerun: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryItem({ entry, onRerun, onDelete }: HistoryItemProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncatedQuery =
    entry.query.length > 100 ? entry.query.substring(0, 100) + '...' : entry.query;

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all
        hover:shadow-sm
        ${entry.success ? 'border-border hover:border-success/30' : 'border-error/30 bg-error/5'}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {entry.success ? (
            <CheckCircle className="w-3.5 h-3.5 text-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-error" />
          )}
          <span className="text-xs text-text-muted">{formatTime(entry.executedAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRerun(entry)}
            title="Load query into editor"
            className="p-1"
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry.id)}
            title="Delete from history"
            className="p-1 text-error hover:text-error"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <pre className="text-xs font-mono bg-surface-hover rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
        {truncatedQuery}
      </pre>

      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          {entry.connectionName}
        </span>
        {entry.database && (
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            {entry.database}
          </span>
        )}
        {entry.collection && (
          <span className="flex items-center gap-1">
            <Table className="w-3 h-3" />
            {entry.collection}
          </span>
        )}
        {entry.tables && entry.tables.length > 0 && (
          <span className="flex items-center gap-1">
            <Table className="w-3 h-3" />
            {entry.tables.join(', ')}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {entry.executionTime}ms
        </span>
        {entry.rowCount !== undefined && <span>{entry.rowCount} rows</span>}
      </div>

      {!entry.success && entry.error && (
        <p className="mt-2 text-xs text-error truncate" title={entry.error}>
          {entry.error}
        </p>
      )}
    </div>
  );
}
