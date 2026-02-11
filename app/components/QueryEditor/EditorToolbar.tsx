'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Trash2,
  Database,
  Wand2,
  CornerDownLeft,
  CornerDownRight,
  FileSearch,
  MoreHorizontal,
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

const languageLabel = (lang: string) =>
  lang === 'postgresql' ? 'PostgreSQL' : lang === 'mysql' ? 'MySQL' : 'MongoDB';

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
  const { activeConnection, connectionStatus, defaultUnlocked } = useConnectionStore();
  const { language } = useQueryStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isConnected = connectionStatus === 'connected' && activeConnection;
  const isExtendedSession = Boolean(activeConnection?.isDefault && defaultUnlocked);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreOpen]);

  const secondaryActions = (
    <>
      <Tooltip content="Format your query with proper indentation">
        <Button variant="ghost" size="sm" onClick={onFormat} className="shrink-0">
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
          className="shrink-0"
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
          className="shrink-0"
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
          className="shrink-0"
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
          className="shrink-0"
        >
          <CornerDownRight className="w-4 h-4 rotate-180" />
          Rollback
        </Button>
      </Tooltip>
      <Tooltip content="Clear all text from the editor">
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0">
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </Tooltip>
      {isExecuting && (
        <Tooltip content="Cancel running query">
          <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
            <Square className="w-4 h-4" />
            Cancel
          </Button>
        </Tooltip>
      )}
    </>
  );

  const mainAction = isExecuting ? (
    <Tooltip content="Cancel running query">
      <Button variant="ghost" size="sm" onClick={onCancel} className="shrink-0">
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
      <Button variant="accent" size="sm" onClick={onExecute} disabled={!isConnected} className="shrink-0">
        <Play className="w-4 h-4" />
        Run
      </Button>
    </Tooltip>
  );

  return (
    <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-2 bg-surface border-b border-border min-h-[44px]">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Database className="w-4 h-4 text-text-secondary shrink-0" />
          <span className="text-xs sm:text-sm font-medium truncate">
            {languageLabel(language)}
          </span>
        </div>
        <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />
        <StatusBadge status={connectionStatus} isExtendedSession={isExtendedSession}>
          <span className="hidden sm:inline">
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus}
          </span>
        </StatusBadge>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* lg: all actions in a scrollable row; below lg: Run + More dropdown */}
        <div className="hidden lg:flex items-center gap-2 overflow-x-auto max-w-[min(50vw,480px)] py-1">
          {secondaryActions}
        </div>
        <div className="lg:hidden relative" ref={moreRef}>
          <Tooltip content="More actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMoreOpen((o) => !o)}
              className="shrink-0"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label="More editor actions"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">More</span>
            </Button>
          </Tooltip>
          {moreOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-50 py-1 bg-surface border border-border rounded-lg shadow-lg flex flex-col min-w-[160px] max-h-[70vh] overflow-y-auto"
              role="menu"
              aria-label="Editor actions"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { onFormat(); setMoreOpen(false); }}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <Wand2 className="w-4 h-4 shrink-0" />
                Format
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onExplain(); setMoreOpen(false); }}
                disabled={!isConnected || isExecuting || isTransactionActive}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:opacity-50"
              >
                <FileSearch className="w-4 h-4 shrink-0" />
                Explain
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onBeginTransaction(); setMoreOpen(false); }}
                disabled={!isConnected || isExecuting || isTransactionActive}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:opacity-50"
              >
                <CornerDownLeft className="w-4 h-4 shrink-0" />
                Begin
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onCommitTransaction(); setMoreOpen(false); }}
                disabled={!isConnected || isExecuting || !isTransactionActive}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:opacity-50"
              >
                <CornerDownRight className="w-4 h-4 shrink-0" />
                Commit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onRollbackTransaction(); setMoreOpen(false); }}
                disabled={!isConnected || isExecuting || !isTransactionActive}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:opacity-50"
              >
                <CornerDownRight className="w-4 h-4 rotate-180 shrink-0" />
                Rollback
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { onClear(); setMoreOpen(false); }}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                Clear
              </button>
              {isExecuting && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { onCancel(); setMoreOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2.5 text-left text-sm min-h-[44px] hover:bg-surface-hover w-full focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  <Square className="w-4 h-4 shrink-0" />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
        {mainAction}
      </div>
    </div>
  );
}
