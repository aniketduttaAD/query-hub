export type DatabaseType = 'postgresql' | 'mongodb' | 'mysql';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Connection {
  id: string;
  name: string;
  type: DatabaseType;
  encryptedUrl: string;
  createdAt: number;
  lastUsed?: number;
  isDefault?: boolean;
  useCustomCredentials?: boolean;
}

export interface ActiveConnection {
  connectionId: string;
  sessionId: string;
  type: DatabaseType;
  serverVersion?: string;
  signingKey?: string;
  isDefault?: boolean;
  isIsolated?: boolean;
}

export interface ValidationError {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface QueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  columns?: ColumnInfo[];
  rowCount: number;
  executionTime: number;
  message?: string;
  messageType: MessageType;
  statementCount?: number;
  query?: string;
  database?: string;
  context?: QueryContext;
}

export interface HistoryEntry {
  id: string;
  query: string;
  language: DatabaseType;
  connectionId: string;
  connectionName: string;
  database?: string;
  collection?: string;
  tables?: string[];
  executedAt: number;
  executionTime: number;
  success: boolean;
  rowCount?: number;
  error?: string;
}

export interface DatabaseSchema {
  name: string;
  tables?: TableSchema[];
  collections?: CollectionSchema[];
}

export interface TableSchema {
  name: string;
  type: 'table' | 'view';
  columns?: ColumnSchema[];
}

export interface CollectionSchema {
  name: string;
  documentCount?: number;
  fields?: FieldSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  confidence?: number;
  sampleCount?: number;
}

export interface FieldSchema {
  name: string;
  type: string;
}

export interface TreeNode {
  id: string;
  name: string;
  type: 'database' | 'table' | 'collection' | 'column' | 'field';
  dataType?: string;
  confidence?: number;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  serverVersion?: string;
}

export interface ConnectResponse {
  success: boolean;
  sessionId: string;
  serverVersion?: string;
  signingKey?: string;
}

export interface ExecuteQueryResponse {
  success: boolean;
  data: Record<string, unknown>[];
  columns?: ColumnInfo[];
  rowCount: number;
  executionTime: number;
  error?: string;
  statementCount?: number;
  context?: QueryContext;
}

export interface QueryContext {
  database?: string;
  collection?: string;
  tables?: string[];
  statementCount?: number;
}

export interface TransactionState {
  active: boolean;
  queries: string[];
}

export interface SchemaResponse {
  databases?: string[];
  tables?: { name: string; type: string }[];
  columns?: ColumnSchema[];
}
