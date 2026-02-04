import { useEffect } from 'react';
import { RefreshCw, Database, Loader2 } from 'lucide-react';
import { Button } from '../common';
import { TreeView } from './TreeView';
import { useSchemaStore, useConnectionStore, useQueryStore } from '../../stores';
import type { TreeNode } from '../../types';

export function DatabaseExplorer() {
  const {
    tree,
    isLoading,
    lastRefreshed,
    expandedNodes,
    fetchDatabases,
    fetchTables,
    fetchColumns,
    refresh,
    toggleNode,
    setSelectedDatabase,
  } = useSchemaStore();
  const { activeConnection, connectionStatus } = useConnectionStore();
  const { setQuery, currentQuery } = useQueryStore();

  const isConnected = connectionStatus === 'connected' && activeConnection;

  useEffect(() => {
    if (isConnected && !lastRefreshed) {
      fetchDatabases(activeConnection.sessionId, activeConnection.signingKey);
    }
  }, [
    isConnected,
    lastRefreshed,
    activeConnection?.sessionId,
    activeConnection?.signingKey,
    fetchDatabases,
  ]);

  useEffect(() => {
    if (!isConnected) {
      useSchemaStore.getState().clearSchema();
    }
  }, [isConnected]);

  const handleRefresh = () => {
    if (isConnected) {
      refresh(activeConnection.sessionId, activeConnection.signingKey);
    }
  };

  const handleNodeExpand = async (node: TreeNode) => {
    if (!isConnected) return;

    toggleNode(node.id);

    if (!expandedNodes.has(node.id)) {
      if (node.type === 'database' && (!node.children || node.children.length === 0)) {
        await fetchTables(activeConnection.sessionId, node.name, activeConnection.signingKey);
      } else if (
        (node.type === 'table' || node.type === 'collection') &&
        (!node.children || node.children.length === 0)
      ) {
        const dbName = node.id.split('-')[1];
        await fetchColumns(
          activeConnection.sessionId,
          dbName,
          node.name,
          activeConnection.signingKey,
        );
      }
    }
  };

  const handleNodeClick = (node: TreeNode) => {
    if (node.type === 'database') {
      setSelectedDatabase(node.name);
      return;
    }
    if (node.type === 'table' || node.type === 'collection') {
      const dbType = activeConnection?.type;
      if (dbType === 'postgresql' || dbType === 'mysql') {
        const insertion = node.name;
        const trimmed = currentQuery.trimEnd();
        setQuery(trimmed ? `${trimmed} ${insertion}` : insertion);
      } else if (dbType === 'mongodb') {
        const insertion = `db.${node.name}`;
        setQuery(currentQuery.trimEnd().endsWith('.') ? currentQuery + node.name : insertion);
      }
    }
  };

  const formatLastRefreshed = () => {
    if (!lastRefreshed) return null;
    const date = new Date(lastRefreshed);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Database className="w-12 h-12 text-text-muted mb-3 opacity-40" />
        <p className="text-sm text-text-secondary">Connect to a database</p>
        <p className="text-xs text-text-muted mt-1">Select a connection from the Connections tab</p>
      </div>
    );
  }

  const emptyLabel =
    activeConnection?.type === 'postgresql' ? 'No schemas found' : 'No databases found';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div>
          <h4 className="text-sm font-semibold text-primary">Schema Explorer</h4>
          {isLoading && tree.length > 0 ? (
            <p className="text-xs text-text-muted">Refreshing schema...</p>
          ) : lastRefreshed ? (
            <p className="text-xs text-text-muted">Updated at {formatLastRefreshed()}</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh schema"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading && tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent mb-2" />
            <span className="text-sm text-text-secondary">Loading schema...</span>
          </div>
        ) : (
          <TreeView
            nodes={tree}
            onNodeClick={handleNodeClick}
            onNodeExpand={handleNodeExpand}
            expandedNodes={expandedNodes}
            emptyLabel={emptyLabel}
          />
        )}
      </div>

      <div className="p-3 border-t border-border bg-surface-hover">
        <p className="text-xs text-text-muted">
          Click on a table to insert its name into the editor
        </p>
      </div>
    </div>
  );
}
