import pg from 'pg';
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

const { Pool } = pg;

const PG_TYPE_MAP: Record<number, string> = {
  16: 'boolean',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'bigint',
  21: 'smallint',
  23: 'integer',
  25: 'text',
  26: 'oid',
  114: 'json',
  142: 'xml',
  700: 'real',
  701: 'double precision',
  790: 'money',
  1042: 'char',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1560: 'bit',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
};

function pgTypeToString(oid: number): string {
  return PG_TYPE_MAP[oid] || `unknown(${oid})`;
}

export class PostgresAdapter implements DatabaseAdapter {
  private pool: pg.Pool | null = null;
  private connectionUrl: string = '';
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private transactionClient: pg.PoolClient | null = null;
  private isDefaultConfig: boolean = false;

  async connect(connectionUrl: string): Promise<void> {
    this.connectionUrl = connectionUrl;
    const defaults = loadDefaultDatabases();
    this.isDefaultConfig = defaults.some(
      (db) => db.type === 'postgresql' && db.url === connectionUrl,
    );
    this.pool = new Pool({
      connectionString: connectionUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const client = await this.pool.connect();
    client.release();
    this.startHealthCheck();
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    if (this.transactionClient) {
      try {
        await this.transactionClient.query('ROLLBACK');
      } finally {
        this.transactionClient.release();
        this.transactionClient = null;
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
    const message = `Query executed successfully (simulated). Your query syntax is correct, but destructive operations like ${operation} are only allowed when connecting to your own database. Use your own PostgreSQL connection URL to perform this operation.`;
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
    if (/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW|INDEX|FUNCTION|PROCEDURE|TRIGGER)\b/i.test(query)) {
      const match = query.match(/\bDROP\s+(\w+)/i);
      return { isDestructive: true, operation: match ? `DROP ${match[1].toUpperCase()}` : 'DROP' };
    }
    if (/\bTRUNCATE\s+TABLE\b/i.test(query)) {
      return { isDestructive: true, operation: 'TRUNCATE TABLE' };
    }
    if (/\bDELETE\s+FROM\b/i.test(query) && !normalizedQuery.includes('WHERE 1=0')) {
      return { isDestructive: true, operation: 'DELETE' };
    }
    return { isDestructive: false };
  }

  async executeQuery(
    query: string,
    database?: string,
    options?: QueryOptions,
  ): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');

    if (this.isDefaultConfig && !options?.allowDestructive) {
      const destructiveCheck = this.isDestructiveQuery(query);
      if (destructiveCheck.isDestructive) {
        return this.simulateDestructiveOperation(
          destructiveCheck.operation || 'destructive operation',
        );
      }
    }

    const startTime = Date.now();
    const client = this.transactionClient ?? (await this.pool.connect());
    const shouldRelease = !this.transactionClient;

    try {
      if (database) {
        const schema = this.sanitizeSchemaName(database);
        await client.query({ text: `SET search_path TO "${schema.replace(/"/g, '""')}", public` });
      }

      await client.query(`SET statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS}`);

      let finalQuery: string;
      if (options?.explain) {
        // Use EXPLAIN ANALYZE with detailed output options
        finalQuery = `EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT TEXT) ${query}`;
      } else {
        finalQuery = applySqlPagination(query, options);
      }
      const result = await client.query(finalQuery);

      const columns: ColumnInfo[] = result.fields
        ? result.fields.map((f) => ({
            name: f.name,
            type: pgTypeToString(f.dataTypeID),
          }))
        : [];

      return {
        rows: result.rows,
        columns,
        rowCount: result.rowCount ?? result.rows.length,
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (shouldRelease) {
        client.release();
      }
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(
      `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `,
    );
    return result.rows.map((r) => r.schema_name);
  }

  async getDatabaseNames(): Promise<string[]> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query(
      `
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `,
    );
    return result.rows.map((r) => r.datname);
  }

  async getTables(database: string): Promise<TableInfo[]> {
    if (!this.pool) throw new Error('Not connected');

    const schema = this.sanitizeSchemaName(database || 'public');
    const result = await this.pool.query(
      `
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name
    `,
      [schema],
    );

    return result.rows.map((r) => ({
      name: r.table_name,
      type: r.table_type === 'VIEW' ? 'view' : 'table',
    }));
  }

  async getColumns(database: string, table: string): Promise<ColumnSchema[]> {
    if (!this.pool) throw new Error('Not connected');

    const schema = this.sanitizeSchemaName(database || 'public');
    const result = await this.pool.query(
      `
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.column_name = pk.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `,
      [schema, table],
    );

    return result.rows.map((r) => ({
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === 'YES',
      primaryKey: r.is_primary_key,
    }));
  }

  async getServerVersion(): Promise<string> {
    if (!this.pool) throw new Error('Not connected');

    const result = await this.pool.query('SELECT version()');
    return result.rows[0]?.version || 'Unknown';
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');
    if (this.transactionClient) {
      throw new Error('Transaction already active');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      this.transactionClient = client;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionClient) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionClient.query('COMMIT');
    } finally {
      this.transactionClient.release();
      this.transactionClient = null;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transactionClient) {
      throw new Error('No active transaction');
    }
    try {
      await this.transactionClient.query('ROLLBACK');
    } finally {
      this.transactionClient.release();
      this.transactionClient = null;
    }
  }

  isTransactionActive(): boolean {
    return this.transactionClient !== null;
  }

  async cleanupDatabase(database: string): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    const schema = this.sanitizeSchemaName(database || 'public');
    const client = await this.pool.connect();

    try {
      await this.cleanupSchemaWithClient(client, schema);

      logger.logDatabaseOperation('cleanup completed', database);
    } finally {
      client.release();
    }
  }

  async cleanupAllSchemas(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    const client = await this.pool.connect();
    try {
      const schemasResult = await client.query(
        `
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schema_name
      `,
      );

      for (const row of schemasResult.rows as Array<{ schema_name: string }>) {
        const schema = this.sanitizeSchemaName(row.schema_name);
        await this.cleanupSchemaWithClient(client, schema);
      }
    } finally {
      client.release();
    }
  }

  /** Drops all user databases (except postgres, template0, template1). Call when connected to postgres. */
  async dropAllUserDatabases(): Promise<void> {
    if (!this.pool) throw new Error('Not connected');

    const names = await this.getDatabaseNames();
    const system = ['postgres', 'template0', 'template1'];
    const client = await this.pool.connect();

    try {
      for (const name of names) {
        if (system.includes(name)) continue;
        const safe = name.replace(/"/g, '""');
        try {
          await client.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [name],
          );
          await client.query(`DROP DATABASE IF EXISTS "${safe}"`);
          logger.logDatabaseOperation('database dropped', name);
        } catch (error) {
          logger.error('Failed to drop database', error, { database: name });
        }
      }
    } finally {
      client.release();
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(async () => {
      if (!this.pool) return;
      try {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
      } catch (error) {
        logger.error('Postgres pool health check failed', error);
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

  private sanitizeSchemaName(schema: string): string {
    if (!schema) return 'public';
    const cleaned = schema.replace(/[^a-zA-Z0-9_]/g, '');
    return cleaned || 'public';
  }

  private async cleanupSchemaWithClient(
    client: import('pg').PoolClient,
    schema: string,
  ): Promise<void> {
    const tablesResult = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [schema],
    );
    for (const row of tablesResult.rows as Array<{ tablename: string }>) {
      await client
        .query(`DROP TABLE IF EXISTS "${schema}"."${row.tablename}" CASCADE`)
        .catch((error) => {
          logger.error('Failed to drop table', error, { table: row.tablename, schema });
        });
    }

    const functionsResult = await client.query(
      `SELECT proname, oidvectortypes(proargtypes) as args 
       FROM pg_proc 
       WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)`,
      [schema],
    );
    for (const row of functionsResult.rows as Array<{ proname: string; args: string }>) {
      await client
        .query(`DROP FUNCTION IF EXISTS "${schema}"."${row.proname}"(${row.args}) CASCADE`)
        .catch((error) => {
          logger.error('Failed to drop function', error, { function: row.proname, schema });
        });
    }

    const triggersResult = await client.query(
      `SELECT trigger_name, event_object_table 
       FROM information_schema.triggers 
       WHERE trigger_schema = $1`,
      [schema],
    );
    for (const row of triggersResult.rows as Array<{
      trigger_name: string;
      event_object_table: string;
    }>) {
      await client
        .query(
          `DROP TRIGGER IF EXISTS "${row.trigger_name}" ON "${schema}"."${row.event_object_table}" CASCADE`,
        )
        .catch((error) => {
          logger.error('Failed to drop trigger', error, { trigger: row.trigger_name, schema });
        });
    }
  }
}
