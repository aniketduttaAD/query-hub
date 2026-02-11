export type DatabaseType = 'postgresql' | 'mongodb' | 'mysql';

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  rowCount: number;
  executionTime: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  userId?: string;
  isIsolated?: boolean;
  userDatabase?: string;
  explain?: boolean;
  allowDestructive?: boolean;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableInfo {
  name: string;
  type: 'table' | 'view' | 'collection';
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable?: boolean;
  primaryKey?: boolean;
  confidence?: number;
  sampleCount?: number;
}

export interface DatabaseAdapter {
  connect(connectionUrl: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery(query: string, database?: string, options?: QueryOptions): Promise<QueryResult>;
  getDatabases(): Promise<string[]>;
  getTables(database: string): Promise<TableInfo[]>;
  getColumns(database: string, table: string): Promise<ColumnSchema[]>;
  getServerVersion(): Promise<string>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  isTransactionActive(): boolean;
  cleanupDatabase(database: string): Promise<void>;
}

export interface Session {
  id: string;
  adapter: DatabaseAdapter;
  type: DatabaseType;
  createdAt: Date;
  lastActivity: Date;
  signingKey: string;
  userId?: string;
  isIsolated?: boolean;
  isDefaultConnection?: boolean;
  allowDestructive?: boolean;
  userDatabase?: string;
}
