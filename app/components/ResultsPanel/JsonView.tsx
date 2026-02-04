import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';

interface JsonViewProps {
  data: unknown;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth?: number;
  isLast?: boolean;
}

function JsonNode({ keyName, value, depth = 0, isLast = true }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const [copied, setCopied] = useState(false);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isEmpty = isObject && Object.keys(value as object).length === 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getValueColor = (val: unknown): string => {
    if (val === null) return 'text-text-muted';
    if (typeof val === 'string') return 'text-success';
    if (typeof val === 'number') return 'text-info';
    if (typeof val === 'boolean') return 'text-accent';
    return 'text-text-primary';
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`;
    return String(val);
  };

  const indent = depth * 16;

  if (!isObject) {
    return (
      <div
        className="flex items-center py-0.5 hover:bg-surface-hover rounded group"
        style={{ paddingLeft: indent }}
      >
        {keyName && (
          <>
            <span className="text-primary font-medium">&quot;{keyName}&quot;</span>
            <span className="text-text-secondary mx-1">:</span>
          </>
        )}
        <span className={getValueColor(value)}>{formatValue(value)}</span>
        {!isLast && <span className="text-text-secondary">,</span>}
      </div>
    );
  }

  const entries = Object.entries(value as object);
  const bracket = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div>
      <div
        className="flex items-center py-0.5 hover:bg-surface-hover rounded cursor-pointer group"
        style={{ paddingLeft: indent }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="w-4 h-4 flex items-center justify-center mr-1 text-text-secondary">
          {!isEmpty &&
            (isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            ))}
        </span>
        {keyName && (
          <>
            <span className="text-primary font-medium">&quot;{keyName}&quot;</span>
            <span className="text-text-secondary mx-1">:</span>
          </>
        )}
        <span className="text-text-secondary">{bracket[0]}</span>
        {!isExpanded && !isEmpty && (
          <>
            <span className="text-text-muted mx-1">
              {entries.length} {isArray ? 'items' : 'keys'}
            </span>
            <span className="text-text-secondary">{bracket[1]}</span>
          </>
        )}
        {isEmpty && <span className="text-text-secondary">{bracket[1]}</span>}
        {!isLast && !isExpanded && <span className="text-text-secondary">,</span>}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="ml-2 opacity-0 group-hover:opacity-100 text-text-muted hover:text-primary transition-opacity"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      {isExpanded && !isEmpty && (
        <>
          {entries.map(([key, val], index) => (
            <JsonNode
              key={key}
              keyName={isArray ? undefined : key}
              value={val}
              depth={depth + 1}
              isLast={index === entries.length - 1}
            />
          ))}
          <div className="py-0.5" style={{ paddingLeft: indent }}>
            <span className="text-text-secondary ml-5">{bracket[1]}</span>
            {!isLast && <span className="text-text-secondary">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonView({ data }: JsonViewProps) {
  if (data === null || data === undefined) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-sm">
        No results to display
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full p-4 font-mono text-sm">
      <JsonNode value={data} />
    </div>
  );
}
