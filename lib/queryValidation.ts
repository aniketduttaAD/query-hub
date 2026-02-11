import { Parser } from 'node-sql-parser';
import type { DatabaseType } from './types';
import { parseMongoQuery } from './adapters/mongoParser';
import { sanitizeQuery } from './security/querySanitizer';
import { DANGEROUS_SQL_PATTERNS } from './security/dangerousPatterns';

const parser = new Parser();

const SQL_DIALECT: Record<Exclude<DatabaseType, 'mongodb'>, string> = {
  postgresql: 'postgresql',
  mysql: 'mysql',
};

export function validateQuery(
  type: DatabaseType,
  query: string,
  isDefaultConnection: boolean = false,
): { valid: boolean; error?: string } {
  if (!query.trim()) {
    return { valid: false, error: 'Query is empty' };
  }

  const securityCheck = sanitizeQuery(type, query, isDefaultConnection);
  if (!securityCheck.safe) {
    return {
      valid: false,
      error: securityCheck.reason || 'Query failed security validation',
    };
  }

  if (type === 'mongodb') {
    try {
      parseMongoQuery(query);
      return { valid: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Invalid MongoDB query';
      return {
        valid: false,
        error: `${msg} Use the form db.collection.method({...}) and ensure JSON/object syntax is valid (matching braces, quoted keys).`,
      };
    }
  }

  try {
    parser.astify(query, { database: SQL_DIALECT[type] });
    return { valid: true };
  } catch (error) {
    const trimmed = query.trim().toUpperCase();
    const isDdl =
      /^\s*(CREATE\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA|TYPE)|ALTER\s+(TABLE|DATABASE|SCHEMA)|DROP\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA|TYPE)|TRUNCATE\s+TABLE)\b/.test(
        trimmed,
      );
    if (isDdl) {
      return { valid: true };
    }
    const msg = error instanceof Error ? error.message : 'Invalid SQL query';
    return {
      valid: false,
      error: `${msg} Check keywords and punctuation for ${type}, balanced parentheses and quotes, and that table/column names exist.`,
    };
  }
}

export function containsDangerousSql(query: string): boolean {
  return DANGEROUS_SQL_PATTERNS.some((pattern) => pattern.test(query));
}

export function extractSqlTables(
  query: string,
  dialect: Exclude<DatabaseType, 'mongodb'>,
): string[] {
  try {
    const ast = parser.astify(query, { database: SQL_DIALECT[dialect] });
    const tables = new Set<string>();

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const nodeObj = node as Record<string, unknown>;
      if ('table' in nodeObj && nodeObj.table) {
        if (Array.isArray(nodeObj.table)) {
          nodeObj.table.forEach((t: unknown) => {
            if (
              t &&
              typeof t === 'object' &&
              'table' in t &&
              typeof (t as Record<string, unknown>).table === 'string'
            ) {
              tables.add((t as Record<string, unknown>).table as string);
            }
          });
        } else if (typeof nodeObj.table === 'string') {
          tables.add(nodeObj.table);
        }
      }
      Object.values(nodeObj).forEach(visit);
    };

    visit(ast);
    return Array.from(tables);
  } catch {
    return [];
  }
}

export function extractSqlDatabases(
  query: string,
  dialect: Exclude<DatabaseType, 'mongodb'>,
): string[] {
  try {
    const ast = parser.astify(query, { database: SQL_DIALECT[dialect] });
    const databases = new Set<string>();

    const visit = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const nodeObj = node as Record<string, unknown>;
      if (typeof nodeObj.db === 'string') {
        databases.add(nodeObj.db);
      }
      if (typeof nodeObj.schema === 'string') {
        databases.add(nodeObj.schema);
      }
      if (typeof nodeObj.database === 'string') {
        databases.add(nodeObj.database);
      }
      Object.values(nodeObj).forEach(visit);
    };

    visit(ast);
    return Array.from(databases);
  } catch {
    return [];
  }
}
