'use client';

import type { ReactNode } from 'react';
import {
  Table,
  Code,
  Clock,
  Rows3,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Download,
} from 'lucide-react';
import { Button } from '../common';
import { TableView } from './TableView';
import { JsonView } from './JsonView';
import { useResultsStore, useConnectionStore } from '../../stores';
import type { MessageType } from '../../types';
import { api } from '../../services/api';

const messageIcons: Record<MessageType, ReactNode> = {
  success: <CheckCircle className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
};

const messageColors: Record<MessageType, string> = {
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-error/10 text-error border-error/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let stringValue: string;
  if (typeof value === 'string') {
    stringValue = value;
  } else if (typeof value === 'object') {
    try {
      stringValue = JSON.stringify(value);
    } catch {
      stringValue = String(value);
    }
  } else {
    stringValue = String(value);
  }
  const escaped = stringValue.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const buildCsv = (data: Record<string, unknown>[], columns?: { name: string }[]): string => {
  const columnNames =
    columns?.map((c) => c.name) ??
    Array.from(
      data.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>()),
    );

  const header = columnNames.map(escapeCsvValue).join(',');
  const rows = data.map((row) => columnNames.map((name) => escapeCsvValue(row[name])).join(','));
  return [header, ...rows].join('\n');
};

const downloadFile = (filename: string, content: unknown, mime: string) => {
  const blob = new Blob([content as never], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export function ResultsPanel() {
  const { results, isLoading, viewMode, setViewMode, setResults } = useResultsStore();
  const { activeConnection } = useConnectionStore();

  const handleExport = async (format: 'csv' | 'json' | 'xlsx') => {
    if (!results) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `query-results-${timestamp}`;

    const shouldStream =
      (format === 'csv' || format === 'json') &&
      results.data.length > 1000 &&
      results.query &&
      activeConnection?.sessionId;

    if (shouldStream) {
      try {
        const response = await api.exportQuery(
          activeConnection!.sessionId,
          results.query!,
          results.database,
          format,
          activeConnection!.signingKey,
        );
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const message = errData?.error || `Export failed (${response.status})`;
          setResults({
            ...results,
            message: `Export failed: ${message}`,
            messageType: 'error',
          });
          return;
        }
        const blob = await response.blob();
        downloadFile(
          `${baseName}.${format}`,
          blob,
          format === 'json' ? 'application/json' : 'text/csv',
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Export failed';
        setResults({
          ...results,
          message: `Export failed: ${message}`,
          messageType: 'error',
        });
      }
      return;
    }

    if (format === 'json') {
      const payload = JSON.stringify(results.data, null, 2);
      downloadFile(`${baseName}.json`, payload, 'application/json');
      return;
    }

    if (format === 'csv') {
      const payload = buildCsv(results.data, results.columns);
      downloadFile(`${baseName}.csv`, payload, 'text/csv');
      return;
    }

    const xlsx = await import('xlsx');
    const worksheet = xlsx.utils.json_to_sheet(results.data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');
    const buffer = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' });
    downloadFile(
      `${baseName}.xlsx`,
      buffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface rounded-lg border border-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 sm:px-4 py-2 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <h3 className="text-sm font-semibold text-primary shrink-0">Results</h3>
          {results && (
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-text-secondary shrink-0">
              <span className="flex items-center gap-1">
                <Rows3 className="w-3.5 h-3.5 shrink-0" />
                {results.rowCount} row{results.rowCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {results.executionTime}ms
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
          <div className="flex items-center bg-surface-hover rounded-md p-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExport('csv')}
              className="px-1.5 sm:px-2"
              title="Export as CSV"
              disabled={!results?.data?.length}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExport('json')}
              className="px-1.5 sm:px-2"
              title="Export as JSON"
              disabled={!results?.data?.length}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExport('xlsx')}
              className="px-1.5 sm:px-2"
              title="Export as Excel"
              disabled={!results?.data?.length}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
          </div>
          <div className="flex items-center bg-surface-hover rounded-md p-0.5 shrink-0">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="px-2"
              title="Table view"
            >
              <Table className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'json' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('json')}
              className="px-2"
              title="JSON view"
            >
              <Code className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {results?.message && (
        <div
          className={`
            flex items-center gap-2 px-2 sm:px-4 py-2 text-sm border-b shrink-0 min-w-0
            ${messageColors[results.messageType]}
          `}
        >
          <span className="shrink-0">{messageIcons[results.messageType]}</span>
          <span className="flex-1 min-w-0 truncate">{results.message}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden min-w-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-secondary">Executing query...</span>
            </div>
          </div>
        ) : results ? (
          viewMode === 'table' ? (
            <TableView data={results.data} columns={results.columns} />
          ) : (
            <JsonView data={results.data} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <Table className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">Run a query to see results</p>
            <p className="text-xs mt-1">Press Ctrl+Enter to execute</p>
          </div>
        )}
      </div>
    </div>
  );
}
