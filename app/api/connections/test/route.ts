import type { DatabaseType } from '@/lib/types';
import { connectionManager } from '@/lib/ConnectionManager';
import { connectionLimiter, rateLimitHeaders } from '@/lib/rateLimit';
import { getClientIp, parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { jsonResponse } from '@/lib/response';
import { validateConnectionUrl } from '@/lib/validation';

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

  const body = await parseJsonBody<{ type: DatabaseType; connectionUrl: string }>(request);
  if (body.error) {
    return jsonResponse(
      { success: false, error: body.error },
      { status: body.status ?? 400, headers },
    );
  }

  const { type, connectionUrl } = body.data ?? {};

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
    const { sessionId, serverVersion } = await connectionManager.createSession(type, connectionUrl);

    await connectionManager.closeSession(sessionId);

    return jsonResponse(
      {
        success: true,
        message: 'Connection successful',
        serverVersion,
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
