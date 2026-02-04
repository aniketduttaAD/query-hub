import type { ReactNode } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  Columns,
  Folder,
  File,
  Loader2,
} from 'lucide-react';
import type { TreeNode } from '../../types';

interface TreeViewProps {
  nodes: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  onNodeExpand?: (node: TreeNode) => void;
  expandedNodes: Set<string>;
  emptyLabel?: string;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  onNodeClick?: (node: TreeNode) => void;
  onNodeExpand?: (node: TreeNode) => void;
  isExpanded: boolean;
  expandedNodes: Set<string>;
}

const nodeIcons: Record<string, ReactNode> = {
  database: <Database className="w-4 h-4 text-info" />,
  table: <Table className="w-4 h-4 text-success" />,
  collection: <Folder className="w-4 h-4 text-accent" />,
  column: <Columns className="w-4 h-4 text-text-secondary" />,
  field: <File className="w-4 h-4 text-text-secondary" />,
};

function TreeNodeItem({
  node,
  depth,
  onNodeClick,
  onNodeExpand,
  isExpanded,
  expandedNodes,
}: TreeNodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const canExpand = node.type === 'database' || node.type === 'table' || node.type === 'collection';

  const handleToggle = () => {
    if (canExpand) {
      onNodeExpand?.(node);
    }
  };

  const handleClick = () => {
    onNodeClick?.(node);
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded
          hover:bg-surface-hover transition-colors
          ${depth === 0 ? '' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleToggle}
      >
        <span
          className="w-4 h-4 flex items-center justify-center flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          {node.isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
          ) : canExpand ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3 text-text-secondary" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-secondary" />
            )
          ) : null}
        </span>

        <span className="flex-shrink-0">{nodeIcons[node.type]}</span>

        <span className="text-sm truncate flex-1" title={node.name}>
          {node.name}
        </span>

        {node.dataType && (
          <span className="text-xs text-text-muted ml-2 flex-shrink-0">
            {node.dataType}
            {node.confidence !== undefined ? ` ${Math.round(node.confidence * 100)}%` : ''}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              onNodeExpand={onNodeExpand}
              isExpanded={expandedNodes.has(child.id)}
              expandedNodes={expandedNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  nodes,
  onNodeClick,
  onNodeExpand,
  expandedNodes,
  emptyLabel,
}: TreeViewProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
        <Database className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">{emptyLabel || 'No databases found'}</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          depth={0}
          onNodeClick={onNodeClick}
          onNodeExpand={onNodeExpand}
          isExpanded={expandedNodes.has(node.id)}
          expandedNodes={expandedNodes}
        />
      ))}
    </div>
  );
}
