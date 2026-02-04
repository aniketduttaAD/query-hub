import { connectionManager } from '@/lib/ConnectionManager';
import { parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { validateRequestSignature } from '@/lib/requestSigning';
import { validateQuery, containsDangerousSql, extractSqlDatabases } from '@/lib/queryValidation';
import { splitSqlStatements } from '@/lib/sqlStatements';

export const runtime = 'nodejs';

interface ExportBody {
  sessionId: string;
  query: string;
  database?: string;
  format: 'csv' | 'json';
}

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let stringValue: string;
  if (typeof value === 'string') {
    stringValue = value;
  } else if (typeof value === 'object') {
    try {
      stringValue = JSON.stringify(value);
    } catch {
      stringValue = String(value);
    }
  } else {
    stringValue = String(value);
  }
  const escaped = stringValue.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const createJsonStream = (rows: Record<string, unknown>[]) => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('['));
      for (const row of rows) {
        const prefix = index === 0 ? '' : ',';
        controller.enqueue(encoder.encode(`${prefix}${JSON.stringify(row)}`));
        index += 1;
      }
      controller.enqueue(encoder.encode(']'));
      controller.close();
    },
  });
};

const createCsvStream = (rows: Record<string, unknown>[], columns?: { name: string }[]) => {
  const encoder = new TextEncoder();
  const columnNames =
    columns?.map((c) => c.name) ??
    Array.from(
      rows.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>()),
    );

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${columnNames.map(escapeCsvValue).join(',')}\n`));
      for (const row of rows) {
        const line = columnNames.map((name) => escapeCsvValue(row[name])).join(',');
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
};

export async function POST(request: Request) {
  const body = await parseJsonBody<ExportBody>(request);
  if (body.error) {
    return Response.json({ success: false, error: body.error }, { status: body.status ?? 400 });
  }

  const { sessionId, query, database, format } = body.data ?? {};
  if (!sessionId || !query || !format) {
    return Response.json(
      { success: false, error: 'Missing sessionId, query, or format' },
      { status: 400 },
    );
  }

  const session = connectionManager.getSession(sessionId);
  if (!session) {
    return Response.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
  }

  const signatureResult = validateRequestSignature(
    session.signingKey,
    body.data,
    request.headers.get('x-timestamp'),
    request.headers.get('x-signature'),
  );
  if (!signatureResult.valid) {
    return Response.json(
      { success: false, error: signatureResult.error || 'Invalid request signature' },
      { status: 401 },
    );
  }

  try {
    const statements = session.type === 'mongodb' ? [query] : splitSqlStatements(query);
    if (session.type !== 'mongodb' && statements.length !== 1) {
      return Response.json(
        { success: false, error: 'Export supports a single SQL statement at a time' },
        { status: 400 },
      );
    }

    if (session.isIsolated && session.type !== 'mongodb' && containsDangerousSql(query)) {
      return Response.json(
        { success: false, error: 'Query contains potentially dangerous operations' },
        { status: 400 },
      );
    }

    const validation = validateQuery(session.type, query, session.isIsolated ?? false);
    if (!validation.valid) {
      return Response.json(
        { success: false, error: validation.error || 'Query validation failed' },
        { status: 400 },
      );
    }

    if (session.isIsolated && session.type === 'mysql' && session.userDatabase) {
      const referencedDatabases = extractSqlDatabases(query, 'mysql').map((db) => db.toLowerCase());
      const allowed = new Set<string>([session.userDatabase.toLowerCase()]);
      const selectedDb = database?.trim();
      if (selectedDb !== undefined && selectedDb !== '') {
        allowed.add(selectedDb.toLowerCase());
      }
      const hasForbidden = referencedDatabases.some((db) => db && !allowed.has(db));
      if (hasForbidden) {
        return Response.json(
          { success: false, error: 'Access denied: cannot access databases outside your session' },
          { status: 403 },
        );
      }
    }

    const effectiveDatabase =
      database?.trim() !== ''
        ? database
        : session.type !== 'mongodb' && session.isIsolated && session.userDatabase
          ? session.userDatabase
          : database;
    const result = await session.adapter.executeQuery(query, effectiveDatabase, {
      limit: undefined,
    });
    const filename = `query-results.${format}`;
    const headers = new Headers({
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });

    if (format === 'json') {
      headers.set('Content-Type', 'application/json');
      return new Response(createJsonStream(result.rows), { headers });
    }

    headers.set('Content-Type', 'text/csv');
    return new Response(createCsvStream(result.rows, result.columns), { headers });
  } catch (error) {
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Export failed');
    return Response.json({ success: false, error: message }, { status: 400 });
  }
}
