import { connectionManager } from '@/lib/ConnectionManager';
import { queryLimiter, rateLimitHeaders } from '@/lib/rateLimit';
import { getClientIp, parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { validateQuery, extractSqlTables } from '@/lib/queryValidation';
import { splitSqlStatements } from '@/lib/sqlStatements';
import { validateRequestSignature } from '@/lib/requestSigning';
import { jsonResponse } from '@/lib/response';
import { parseMongoQuery } from '@/lib/adapters/mongoParser';
import { SELECT_LIKE_REGEX } from '@/lib/adapters/sqlUtils';
import type { QueryOptions } from '@/lib/types';

export const runtime = 'nodejs';

interface ExecuteQueryBody {
  sessionId: string;
  query: string;
  database?: string;
  limit?: number;
  offset?: number;
  explain?: boolean;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limitResult = await queryLimiter(ip);
  const headers = rateLimitHeaders(limitResult);

  if (!limitResult.success) {
    return jsonResponse(
      { success: false, error: 'Too many queries, please slow down' },
      { status: 429, headers, compress: false },
    );
  }

  const body = await parseJsonBody<ExecuteQueryBody>(request);
  if (body.error) {
    return jsonResponse(
      {
        success: false,
        error: body.error,
        data: [],
        columns: [],
        rowCount: 0,
        executionTime: 0,
      },
      { status: body.status ?? 400, headers, compress: false },
    );
  }

  const { sessionId, query, database, limit, offset, explain } = body.data ?? {};

  if (!sessionId || !query) {
    return jsonResponse(
      { success: false, error: 'Missing sessionId or query' },
      { status: 400, headers, compress: false },
    );
  }

  const session = connectionManager.getSession(sessionId);
  if (!session) {
    return jsonResponse(
      { success: false, error: 'Invalid or expired session' },
      { status: 401, headers, compress: false },
    );
  }

  try {
    const signatureResult = validateRequestSignature(
      session.signingKey,
      body.data,
      request.headers.get('x-timestamp'),
      request.headers.get('x-signature'),
    );
    if (!signatureResult.valid) {
      return jsonResponse(
        { success: false, error: signatureResult.error || 'Invalid request signature' },
        { status: 401, headers, compress: false },
      );
    }

    const options = {
      limit: typeof limit === 'number' ? limit : undefined,
      offset: typeof offset === 'number' ? offset : undefined,
      explain: explain === true,
    };

    const statements = session.type === 'mongodb' ? [query] : splitSqlStatements(query);

    if (session.type !== 'mongodb' && statements.length === 0) {
      return jsonResponse(
        { success: false, error: 'No executable SQL statements found' },
        { status: 400, headers, compress: false },
      );
    }

    if (session.type === 'mongodb' && statements.length > 1) {
      return jsonResponse(
        { success: false, error: 'MongoDB queries must be executed one at a time' },
        { status: 400, headers, compress: false },
      );
    }

    if (options.explain && session.type !== 'mongodb') {
      const nonExplainable = statements.find((s) => !SELECT_LIKE_REGEX.test(s.trim()));
      if (nonExplainable) {
        return jsonResponse(
          {
            success: false,
            error:
              'Explain is only available for SELECT, WITH, SHOW, and DESCRIBE queries. Use Run to execute this statement.',
          },
          { status: 400, headers, compress: false },
        );
      }
    }

    const effectiveDatabase =
      database?.trim() !== ''
        ? database
        : session.type !== 'mongodb' && session.isIsolated && session.userDatabase
          ? session.userDatabase
          : database;

    let lastResult = null;
    let totalExecutionTime = 0;

    for (const statement of statements) {
      const validation = validateQuery(
        session.type,
        statement,
        session.type === 'mongodb' ? false : (session.isIsolated ?? false),
      );
      if (!validation.valid) {
        return jsonResponse(
          { success: false, error: validation.error || 'Query validation failed' },
          { status: 400, headers, compress: false },
        );
      }

      const queryOptions: QueryOptions = {
        ...options,
        explain: options.explain,
      };

      if (session.type !== 'mongodb') {
        queryOptions.userId = session.userId;
        queryOptions.isIsolated = session.isIsolated ?? false;
        queryOptions.userDatabase = session.userDatabase;
      }
      const result = await session.adapter.executeQuery(statement, effectiveDatabase, queryOptions);
      lastResult = result;
      totalExecutionTime += result.executionTime;
    }

    const context =
      session.type === 'mongodb'
        ? (() => {
            try {
              const parsed = parseMongoQuery(query);
              return {
                database: parsed.database || effectiveDatabase,
                collection: parsed.collection,
                statementCount: statements.length,
              };
            } catch {
              return { database: effectiveDatabase, statementCount: statements.length };
            }
          })()
        : {
            database: effectiveDatabase,
            tables: extractSqlTables(query, session.type),
            statementCount: statements.length,
          };

    const result = lastResult;
    if (!result) {
      return jsonResponse(
        { success: false, error: 'No results returned' },
        { status: 400, headers, compress: false },
      );
    }

    return jsonResponse(
      {
        success: true,
        data: result.rows,
        columns: result.columns,
        rowCount: result.rowCount,
        executionTime: totalExecutionTime,
        statementCount: statements.length,
        context,
      },
      { headers, compress: true },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Query execution failed',
    );
    return jsonResponse(
      {
        success: false,
        error: message,
        data: [],
        columns: [],
        rowCount: 0,
        executionTime: 0,
      },
      { status: 400, headers, compress: false },
    );
  }
}
