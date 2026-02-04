import type { DatabaseType } from '@/lib/types';
import { connectionManager } from '@/lib/ConnectionManager';
import { connectionLimiter, rateLimitHeaders } from '@/lib/rateLimit';
import { getClientIp, parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { jsonResponse } from '@/lib/response';
import { validateConnectionUrl } from '@/lib/validation';
import { loadDefaultDatabases } from '@/lib/config/databaseConfig';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limitResult = await connectionLimiter(ip);
  const headers = rateLimitHeaders(limitResult);

  if (!limitResult.success) {
    return jsonResponse(
      { success: false, error: 'Too many connection attempts, please slow down' },
      { status: 429, headers },
    );
  }

  const body = await parseJsonBody<{
    type: DatabaseType;
    connectionUrl: string;
    userId?: string;
    isIsolated?: boolean;
  }>(request);
  if (body.error) {
    return jsonResponse(
      { success: false, error: body.error },
      { status: body.status ?? 400, headers },
    );
  }

  const { type, connectionUrl, userId, isIsolated } = body.data ?? {};

  if (!type || !connectionUrl) {
    return jsonResponse(
      { success: false, error: 'Missing type or connectionUrl' },
      { status: 400, headers },
    );
  }

  if (!validateConnectionUrl(type, connectionUrl)) {
    return jsonResponse(
      { success: false, error: `Invalid connection URL format for ${type}` },
      { status: 400, headers },
    );
  }

  try {
    const defaults = loadDefaultDatabases();
    const matchesDefault = defaults.some((db) => db.type === type && db.url === connectionUrl);

    let effectiveUserId: string | undefined = userId;
    let effectiveIsIsolated: boolean;

    if (type === 'mongodb') {
      effectiveIsIsolated = false;
      effectiveUserId = undefined;
    } else {
      // Only use per-user DB (isolation) for the default placeholder URL.
      // Custom URLs connect directly to the database in the URL — no u_xxx created.
      effectiveIsIsolated = matchesDefault ? (isIsolated ?? true) : false;
      if (!userId) {
        return jsonResponse(
          { success: false, error: 'Missing userId for session' },
          { status: 400, headers },
        );
      }
    }

    const { sessionId, serverVersion, signingKey, userDatabase } =
      await connectionManager.createSession(
        type,
        connectionUrl,
        effectiveUserId,
        effectiveIsIsolated,
      );

    return jsonResponse(
      {
        success: true,
        sessionId,
        serverVersion,
        signingKey,
        userDatabase,
        isIsolated: effectiveIsIsolated,
      },
      { headers },
    );
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Connection failed',
    );
    return jsonResponse({ success: false, error: message }, { status: 400, headers });
  }
}
