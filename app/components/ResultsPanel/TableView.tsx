'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { ColumnInfo } from '../../types';

interface TableViewProps {
  data: Record<string, unknown>[];
  columns?: ColumnInfo[];
}

export function TableView({ data, columns }: TableViewProps) {
  const displayColumns = useMemo(() => {
    if (columns) return columns;
    return Array.from(
      data.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>()),
    ).map((name) => ({ name, type: 'unknown' }));
  }, [columns, data]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-sm">
        No results to display
      </div>
    );
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const getCellClass = (value: unknown): string => {
    if (value === null || value === undefined) return 'text-text-muted italic';
    if (typeof value === 'number') return 'text-info font-mono';
    if (typeof value === 'boolean') return 'text-accent font-medium';
    if (typeof value === 'object') return 'text-text-secondary font-mono text-xs';
    return '';
  };

  const rowHeight = 36;

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const row = data[index];
    return (
      <div style={style} className="flex border-b border-border/50 hover:bg-surface-hover text-sm">
        <div className="px-3 py-2 text-text-muted text-xs font-mono w-10 flex-shrink-0">
          {index + 1}
        </div>
        {displayColumns.map((col) => (
          <div
            key={`${index}-${col.name}`}
            className={`px-3 py-2 flex-1 max-w-xs truncate ${getCellClass(row[col.name])}`}
            title={formatValue(row[col.name])}
          >
            {formatValue(row[col.name])}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex bg-surface-hover sticky top-0 border-b border-border text-xs font-semibold text-primary">
        <div className="px-3 py-2 text-text-secondary w-10 flex-shrink-0">#</div>
        {displayColumns.map((col) => (
          <div key={col.name} className="px-3 py-2 flex-1">
            <div className="flex flex-col gap-0.5">
              <span>{col.name}</span>
              {col.type !== 'unknown' && (
                <span className="text-text-muted font-normal">{col.type}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0">
        {size.height > 0 && size.width > 0 && (
          <List
            height={size.height}
            width={size.width}
            itemCount={data.length}
            itemSize={rowHeight}
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
}
