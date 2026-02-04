import mysql from 'mysql2/promise';
import type {
  DatabaseAdapter,
  QueryResult,
  TableInfo,
  ColumnSchema,
  ColumnInfo,
  QueryOptions,
} from '../types';
import { DEFAULT_QUERY_TIMEOUT_MS } from '../queryConfig';
import { logger } from '../logger';
import { applySqlPagination } from './sqlUtils';
import { loadDefaultDatabases } from '../config/databaseConfig';

/** Whitelist: only these characters are allowed in database names to prevent SQL injection. */
const MYSQL_IDENTIFIER_REGEX = /^[a-zA-Z0-9_]+$/;

function sanitizeDatabaseName(database: string): string {
  const trimmed = database.trim();
  if (!trimmed) {
    throw new Error('Database name cannot be empty');
  }
  if (!MYSQL_IDENTIFIER_REGEX.test(trimmed)) {
    throw new Error('Invalid database name: only letters, numbers, and underscores are allowed');
  }
  return trimmed;
}

const MYSQL_TYPE_MAP: Record<string, string> = {
  TINYINT: 'tinyint',
  SMALLINT: 'smallint',
  MEDIUMINT: 'mediumint',
  INT: 'integer',
  INTEGER: 'integer',
  BIGINT: 'bigint',
  FLOAT: 'float',
  DOUBLE: 'double',
  DECIMAL: 'decimal',
  NUMERIC: 'numeric',
  DATE: 'date',
  DATETIME: 'datetime',
  TIMESTAMP: 'timestamp',
  TIME: 'time',
  YEAR: 'year',
  CHAR: 'char',
  VARCHAR: 'varchar',
  TEXT: 'text',
  TINYTEXT: 'tinytext',
  MEDIUMTEXT: 'mediumtext',
  LONGTEXT: 'longtext',
  BINARY: 'binary',
  VARBINARY: 'varbinary',
  BLOB: 'blob',
  TINYBLOB: 'tinyblob',
  MEDIUMBLOB: 'mediumblob',
  LONGBLOB: 'longblob',
  ENUM: 'enum',
  SET: 'set',
  JSON: 'json',
  BIT: 'bit',
  BOOLEAN: 'boolean',
  BOOL: 'boolean',
};

function mysqlTypeToString(type: string): string {
  const upperType = type.toUpperCase();
  for (const [key, value] of Object.entries(MYSQL_TYPE_MAP)) {
    if (upperType.startsWith(key)) {
      return value;
    }
  }
  return type.toLowerCase();
}

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mysql.Pool | null = null;
  private connectionUrl: string = '';
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private transactionConnection: mysql.PoolConnection | null = null;
  private isDefaultConfig: boolean = false;

  async connect(connectionUrl: string): Promise<void> {
    this.connectionUrl = connectionUrl;
    const defaults = loadDefaultDatabases();
    this.isDefaultConfig = defaults.some((db) => db.type === 'mysql' && db.url === connectionUrl);

    const url = new URL(connectionUrl);
    const config: mysql.PoolOptions = {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username || 'root',
      password: url.password || '',
      database: url.pathname.slice(1) || undefined,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
    };

    this.pool = mysql.createPool(config);

    const connection = await this.pool.getConnection();
    connection.release();
    this.startHealthCheck();
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    if (this.transactionConnection) {
      try {
        await this.transactionConnection.query('ROLLBACK');
      } finally {
        this.transactionConnection.release();
        this.transactionConnection = null;
      }
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connectionUrl = '';
    this.isDefaultConfig = false;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  private simulateDestructiveOperation(operation: string, details?: string): QueryResult {
    const message = `Query executed successfully (simulated). Your query syntax is correct, but destructive operations like ${operation} are only allowed when connecting to your own database. Use your own MySQL connection URL to perform this operation.`;
    return {
      rows: [
        {
          acknowledged: true,
          simulated: true,
          message,
          operation,
          ...(details ? { details } : {}),
        },
      ] as Record<string, unknown>[],
      columns: [
        { name: 'acknowledged', type: 'boolean' },
        { name: 'simulated', type: 'boolean' },
        { name: 'message', type: 'string' },
        { name: 'operation', type: 'string' },
        ...(details ? [{ name: 'details', type: 'string' }] : []),
      ],
      rowCount: 1,
      executionTime: 0,
    };
  }

  private isDestructiveQuery(query: string): { isDestructive: boolean; operation?: string } {
    const normalizedQuery = query.trim().toUpperCase();
    if (
      /\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER)\b/.test(
        normalizedQuery,
      )
    ) {
      const match = query.match(/\bDROP\s+(\w+)/i);
      return { isDestructive: true, operation: match ? `DROP ${match[1].toUpperCase()}` : 'DROP' };
    }
    if (/\bTRUNCATE\s+TABLE\b/.test(normalizedQuery)) {
      return { isDestructive: true, operation: 'TRUNCATE TABLE' };
    }
    if (/\bDELETE\s+FROM\b/.test(normalizedQuery) && !normalizedQuery.includes('WHERE 1=0')) {
      return { isDestructive: true, operation: 'DELETE' };
    }
    return { isDestructive: false };
  }

  /** Validate and sanitize database name for USE statement (prevents SQL injection). */
  private validateDatabaseName(database: string): string {
    return sanitizeDatabaseName(database);
  }

  async executeQuery(
    query: string,
    database?: string,
    options?: QueryOptions,
  ): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');

    if (this.isDefaultConfig) {
      const destructiveCheck = this.isDestructiveQuery(query);
      if (destructiveCheck.isDestructive) {
        return this.simulateDestructiveOperation(
          destructiveCheck.operation || 'destructive operation',
        );
      }
    }

    const startTime = Date.now();
    let connection: mysql.PoolConnection | null = null;

    try {
      connection = this.transactionConnection ?? (await this.pool.getConnection());

      if (database) {
        const safeName = this.validateDatabaseName(database);
        await connection.query(`USE \`${safeName}\``);
      }

      let finalQuery: string;
      if (options?.explain) {
        // Use EXPLAIN for query plan analysis
        finalQuery = `EXPLAIN ${query}`;
      } else {
        finalQuery = applySqlPagination(query, options);
      }
      const [results, fields] = await connection.query({
        sql: finalQuery,
        timeout: DEFAULT_QUERY_TIMEOUT_MS,
      });

      let rows: Record<string, unknown>[];
      let columns: ColumnInfo[] = [];
      let rowCount = 0;

      if (Array.isArray(results)) {
        rows = results as Record<string, unknown>[];
        rowCount = rows.length;

        if (fields && Array.isArray(fields)) {
          columns = fields.map((field) => ({
            name: field.name,
            type: mysqlTypeToString(field.type?.toString() || 'unknown'),
          }));
        }
      } else {
        const result = results as mysql.ResultSetHeader;
        rows = [
          {
            affectedRows: result.affectedRows,
            insertId: result.insertId,
            warningStatus: result.warningStatus,
          },
        ];
        columns = [
          { name: 'affectedRows', type: 'integer' },
          { name: 'insertId', type: 'integer' },
          { name: 'warningStatus', type: 'integer' },
        ];
        rowCount = result.affectedRows;
      }

      return {
        rows,
        columns,
        rowCount,
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (connection && !this.transactionConnection) {
        connection.release();
      }
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');

    const [results] = await this.pool.query('SHOW DATABASES');
    const databases = results as Array<{ Database: string }>;

    return databases
      .map((r) => r.Database)
      .filter(
        (name) => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(name),
      )
      .sort();
  }

  async getTables(database: string): Promise<TableInfo[]> {
    if (!this.pool) throw new Error('Not connected');

    const [results] = await this.pool.query(
      `
      SELECT
        TABLE_NAME as name,
        TABLE_TYPE as type
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `,
      [database],
    );

    const tables = results as Array<{ name: string; type: string }>;

    return tables.map((r) => ({
      name: r.name,
      type: r.type === 'VIEW' ? 'view' : 'table',
    }));
  }

  async getColumns(database: string, table: string): Promise<ColumnSchema[]> {
    if (!this.pool) throw new Error('Not connected');

    const [results] = await this.pool.query(
      `
      SELECT
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_KEY as column_key
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `,
      [database, table],
    );

    const columns = results as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_key: string;
    }>;

    return columns.map((r) => ({
      name: r.column_name,
      type: mysqlTypeToString(r.data_type),
      nullable: r.is_nullable === 'YES',
      primaryKey: r.column_key === 'PRI',
    }));
  }

  async getServerVersion(): Promise<string> {
    if (!this.pool) throw new Error('Not connected');

    const [results] = await this.pool.query('SELECT VERSION() as version');
    const rows = results as Array<{ version: string }>;
    return `MySQL ${rows[0]?.version || 'Unknown'}`;
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');
    if (this.transactionConnection) {
      throw new Error('Transaction already active');
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      this.transactionConnection = connection;
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionConnection) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionConnection.commit();
    } finally {
      this.transactionConnection.release();
      this.transactionConnection = null;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionConnection) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionConnection.rollback();
    } finally {
      this.transactionConnection.release();
      this.transactionConnection = null;
    }
  }

  isTransactionActive(): boolean {
    return this.transactionConnection !== null;
  }

  async cleanupDatabase(database: string): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    const connection = await this.pool.getConnection();

    try {
      const [tables] = await connection.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
        [database],
      );
      const tableList = (tables as Array<{ TABLE_NAME: string }>)
        .map((t) => `\`${t.TABLE_NAME}\``)
        .join(', ');
      if (tableList) {
        await connection.query(`DROP TABLE IF EXISTS ${tableList}`).catch((error) => {
          logger.error('Failed to drop tables', error, { database });
        });
      }

      const [functions] = await connection.query(
        `SELECT ROUTINE_NAME FROM information_schema.ROUTINES 
         WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'`,
        [database],
      );
      for (const func of functions as Array<{ ROUTINE_NAME: string }>) {
        await connection
          .query(`DROP FUNCTION IF EXISTS \`${func.ROUTINE_NAME}\``)
          .catch((error) => {
            logger.error('Failed to drop function', error, {
              function: func.ROUTINE_NAME,
              database,
            });
          });
      }

      const [procedures] = await connection.query(
        `SELECT ROUTINE_NAME FROM information_schema.ROUTINES 
         WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
        [database],
      );
      for (const proc of procedures as Array<{ ROUTINE_NAME: string }>) {
        await connection
          .query(`DROP PROCEDURE IF EXISTS \`${proc.ROUTINE_NAME}\``)
          .catch((error) => {
            logger.error('Failed to drop procedure', error, {
              procedure: proc.ROUTINE_NAME,
              database,
            });
          });
      }

      const [triggers] = await connection.query(
        `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
        [database],
      );
      for (const trigger of triggers as Array<{ TRIGGER_NAME: string }>) {
        await connection
          .query(`DROP TRIGGER IF EXISTS \`${trigger.TRIGGER_NAME}\``)
          .catch((error) => {
            logger.error('Failed to drop trigger', error, {
              trigger: trigger.TRIGGER_NAME,
              database,
            });
          });
      }

      logger.logDatabaseOperation('cleanup completed', database);
    } finally {
      connection.release();
    }
  }

  /** Drops all user databases (except system: information_schema, mysql, performance_schema, sys). */
  async dropAllUserDatabases(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    const connection = await this.pool.getConnection();
    const system = ['information_schema', 'mysql', 'performance_schema', 'sys'];

    try {
      const [rows] = await connection.query('SHOW DATABASES');
      const list = rows as Array<{ Database: string }>;
      for (const row of list) {
        const name = row.Database;
        if (system.includes(name)) continue;
        try {
          await connection.query(`DROP DATABASE IF EXISTS \`${name.replace(/`/g, '``')}\``);
          logger.logDatabaseOperation('database dropped', name);
        } catch (error) {
          logger.error('Failed to drop database', error, { database: name });
        }
      }
    } finally {
      connection.release();
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      if (!this.pool) return;
      try {
        const connection = await this.pool.getConnection();
        await connection.query('SELECT 1');
        connection.release();
      } catch (error) {
        logger.error('MySQL pool health check failed', error);
        await this.disconnect();
      }
    }, 60_000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
