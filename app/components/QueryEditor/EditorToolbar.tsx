import {
  Play,
  Square,
  Trash2,
  Database,
  Wand2,
  CornerDownLeft,
  CornerDownRight,
  FileSearch,
} from 'lucide-react';
import { Button, StatusBadge, Tooltip } from '../common';
import { useConnectionStore, useQueryStore } from '../../stores';

interface EditorToolbarProps {
  onExecute: () => void;
  onCancel: () => void;
  onClear: () => void;
  onFormat: () => void;
  onExplain: () => void;
  onBeginTransaction: () => void;
  onCommitTransaction: () => void;
  onRollbackTransaction: () => void;
  isExecuting: boolean;
  isTransactionActive: boolean;
}

export function EditorToolbar({
  onExecute,
  onCancel,
  onClear,
  onFormat,
  onExplain,
  onBeginTransaction,
  onCommitTransaction,
  onRollbackTransaction,
  isExecuting,
  isTransactionActive,
}: EditorToolbarProps) {
  const { activeConnection, connectionStatus } = useConnectionStore();
  const { language } = useQueryStore();

  const isConnected = connectionStatus === 'connected' && activeConnection;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium">
            {language === 'postgresql' ? 'PostgreSQL' : language === 'mysql' ? 'MySQL' : 'MongoDB'}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <StatusBadge status={connectionStatus}>
          {connectionStatus === 'connected' ? 'Connected' : connectionStatus}
        </StatusBadge>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip content="Format your query with proper indentation">
          <Button variant="ghost" size="sm" onClick={onFormat}>
            <Wand2 className="w-4 h-4" />
            Format
          </Button>
        </Tooltip>
        <Tooltip content="Analyze query execution plan (Ctrl+Shift+E)">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExplain}
            disabled={!isConnected || isExecuting || isTransactionActive}
          >
            <FileSearch className="w-4 h-4" />
            Explain
          </Button>
        </Tooltip>
        <Tooltip content="Start a transaction to group multiple operations">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBeginTransaction}
            disabled={!isConnected || isExecuting || isTransactionActive}
          >
            <CornerDownLeft className="w-4 h-4" />
            Begin
          </Button>
        </Tooltip>
        <Tooltip content="Save all changes in the current transaction">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCommitTransaction}
            disabled={!isConnected || isExecuting || !isTransactionActive}
          >
            <CornerDownRight className="w-4 h-4" />
            Commit
          </Button>
        </Tooltip>
        <Tooltip content="Cancel all changes in the current transaction">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRollbackTransaction}
            disabled={!isConnected || isExecuting || !isTransactionActive}
          >
            <CornerDownRight className="w-4 h-4 rotate-180" />
            Rollback
          </Button>
        </Tooltip>
        <Tooltip content="Clear all text from the editor">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </Tooltip>
        {isExecuting ? (
          <Tooltip content="Cancel running query">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <Square className="w-4 h-4" />
              Cancel
            </Button>
          </Tooltip>
        ) : (
          <Tooltip
            content={
              !isConnected
                ? 'Connect to a database first'
                : 'Execute query (Ctrl+Enter / Cmd+Enter)'
            }
          >
            <Button variant="accent" size="sm" onClick={onExecute} disabled={!isConnected}>
              <Play className="w-4 h-4" />
              Run
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
