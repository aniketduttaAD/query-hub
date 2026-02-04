import { create } from 'zustand';
import type { TreeNode } from '../types';
import { api } from '../services/api';
import { logger } from '../../lib/logger';

const CACHE_TTL = 5 * 60 * 1000;

const databasesCache = new Map<string, { data: string[]; timestamp: number }>();
const tablesCache = new Map<
  string,
  { data: { name: string; type: string }[]; timestamp: number }
>();
const columnsCache = new Map<
  string,
  {
    data: { name: string; type: string; confidence?: number; sampleCount?: number }[];
    timestamp: number;
  }
>();

const isCacheValid = (timestamp: number) => Date.now() - timestamp < CACHE_TTL;

interface SchemaState {
  tree: TreeNode[];
  isLoading: boolean;
  lastRefreshed: number | null;
  expandedNodes: Set<string>;
  selectedDatabase: string | null;

  fetchDatabases: (sessionId: string, signingKey?: string) => Promise<void>;
  fetchTables: (sessionId: string, database: string, signingKey?: string) => Promise<void>;
  fetchColumns: (
    sessionId: string,
    database: string,
    table: string,
    signingKey?: string,
  ) => Promise<void>;
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  setSelectedDatabase: (database: string | null) => void;
  clearSchema: () => void;
  refresh: (sessionId: string, signingKey?: string) => Promise<void>;
}

export const useSchemaStore = create<SchemaState>((set, get) => ({
  tree: [],
  isLoading: false,
  lastRefreshed: null,
  expandedNodes: new Set(),
  selectedDatabase: null,

  fetchDatabases: async (sessionId, signingKey) => {
    const cacheKey = sessionId;
    const cached = databasesCache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      const tree: TreeNode[] = cached.data.map((name) => ({
        id: `db-${name}`,
        name,
        type: 'database',
        children: [],
        isExpanded: false,
      }));
      set({ tree, lastRefreshed: Date.now(), isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { databases } = await api.getDatabases(sessionId, signingKey);
      const tree: TreeNode[] = databases.map((name) => ({
        id: `db-${name}`,
        name,
        type: 'database',
        children: [],
        isExpanded: false,
      }));
      databasesCache.set(cacheKey, { data: databases, timestamp: Date.now() });
      set({ tree, lastRefreshed: Date.now(), isLoading: false });
    } catch (error) {
      logger.error('Failed to fetch databases', error);
      set({ isLoading: false });
    }
  },

  fetchTables: async (sessionId, database, signingKey) => {
    const { tree } = get();
    const dbNode = tree.find((n) => n.name === database);
    if (!dbNode) return;

    const cacheKey = `${sessionId}:${database}`;
    const cached = tablesCache.get(cacheKey);

    set({
      tree: tree.map((n) => (n.id === dbNode.id ? { ...n, isLoading: true } : n)),
    });

    if (cached && isCacheValid(cached.timestamp)) {
      const children: TreeNode[] = cached.data.map((t) => ({
        id: `${dbNode.id}-${t.name}`,
        name: t.name,
        type: t.type === 'collection' ? 'collection' : 'table',
        children: [],
        isExpanded: false,
      }));

      set({
        tree: tree.map((n) =>
          n.id === dbNode.id ? { ...n, children, isLoading: false, isExpanded: true } : n,
        ),
        expandedNodes: new Set([...get().expandedNodes, dbNode.id]),
      });
      return;
    }

    try {
      const { tables } = await api.getTables(sessionId, database, signingKey);
      const children: TreeNode[] = tables.map((t) => ({
        id: `${dbNode.id}-${t.name}`,
        name: t.name,
        type: t.type === 'collection' ? 'collection' : 'table',
        children: [],
        isExpanded: false,
      }));

      tablesCache.set(cacheKey, { data: tables, timestamp: Date.now() });

      set({
        tree: tree.map((n) =>
          n.id === dbNode.id ? { ...n, children, isLoading: false, isExpanded: true } : n,
        ),
        expandedNodes: new Set([...get().expandedNodes, dbNode.id]),
      });
    } catch (error) {
      logger.error('Failed to fetch tables', error, { database });
      set({
        tree: tree.map((n) => (n.id === dbNode.id ? { ...n, isLoading: false } : n)),
      });
    }
  },

  fetchColumns: async (sessionId, database, table, signingKey) => {
    const { tree } = get();

    const updateTreeNode = (
      nodes: TreeNode[],
      targetId: string,
      updater: (node: TreeNode) => TreeNode,
    ): TreeNode[] => {
      return nodes.map((node) => {
        if (node.id === targetId) {
          return updater(node);
        }
        if (node.children) {
          return { ...node, children: updateTreeNode(node.children, targetId, updater) };
        }
        return node;
      });
    };

    const dbNode = tree.find((n) => n.name === database);
    if (!dbNode?.children) return;

    const tableNode = dbNode.children.find((n) => n.name === table);
    if (!tableNode) return;

    set({
      tree: updateTreeNode(tree, tableNode.id, (n) => ({
        ...n,
        isLoading: true,
      })),
    });

    const cacheKey = `${sessionId}:${database}:${table}`;
    const cached = columnsCache.get(cacheKey);

    if (cached && isCacheValid(cached.timestamp)) {
      const children: TreeNode[] = cached.data.map((c) => ({
        id: `${tableNode.id}-${c.name}`,
        name: c.name,
        type: tableNode.type === 'collection' ? 'field' : 'column',
        dataType: c.type,
        confidence: c.confidence,
      }));

      set({
        tree: updateTreeNode(tree, tableNode.id, (n) => ({
          ...n,
          children,
          isLoading: false,
          isExpanded: true,
        })),
        expandedNodes: new Set([...get().expandedNodes, tableNode.id]),
      });
      return;
    }

    try {
      const { columns } = await api.getColumns(sessionId, database, table, signingKey);
      const children: TreeNode[] = columns.map((c) => ({
        id: `${tableNode.id}-${c.name}`,
        name: c.name,
        type: tableNode.type === 'collection' ? 'field' : 'column',
        dataType: c.type,
        confidence: c.confidence,
      }));

      columnsCache.set(cacheKey, { data: columns, timestamp: Date.now() });

      set({
        tree: updateTreeNode(tree, tableNode.id, (n) => ({
          ...n,
          children,
          isLoading: false,
          isExpanded: true,
        })),
        expandedNodes: new Set([...get().expandedNodes, tableNode.id]),
      });
    } catch (error) {
      logger.error('Failed to fetch columns', error, { database, table });
      set({
        tree: updateTreeNode(tree, tableNode.id, (n) => ({
          ...n,
          isLoading: false,
        })),
      });
    }
  },

  toggleNode: (nodeId) => {
    const { expandedNodes } = get();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    set({ expandedNodes: newExpanded });
  },

  expandNode: (nodeId) => {
    set({ expandedNodes: new Set([...get().expandedNodes, nodeId]) });
  },

  collapseNode: (nodeId) => {
    const newExpanded = new Set(get().expandedNodes);
    newExpanded.delete(nodeId);
    set({ expandedNodes: newExpanded });
  },

  setSelectedDatabase: (database) => {
    set({ selectedDatabase: database });
  },

  clearSchema: () => {
    set({
      tree: [],
      expandedNodes: new Set(),
      selectedDatabase: null,
      lastRefreshed: null,
    });
  },

  refresh: async (sessionId, signingKey) => {
    get().clearSchema();
    await get().fetchDatabases(sessionId, signingKey);
  },
}));
