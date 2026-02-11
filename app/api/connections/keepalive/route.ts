import { logger } from '@/lib/logger';
import { connectionManager } from '@/lib/ConnectionManager';
import { validateRequestSignature } from '@/lib/requestSigning';
import { jsonResponse } from '@/lib/response';
import { parseJsonBody } from '@/lib/request';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ sessionId: string; timestamp: number }>(request);
    if (body.error) {
      return jsonResponse({ success: false, error: body.error }, { status: body.status ?? 400 });
    }

    const { sessionId, timestamp } = body.data ?? {};

    if (!sessionId) {
      return jsonResponse(
        {
          success: false,
          error: 'Session ID is required',
        },
        { status: 400 },
      );
    }

    // Get session to verify signature
    const session = connectionManager.getSession(sessionId);
    if (!session) {
      return jsonResponse(
        {
          success: false,
          error: 'Session not found or expired',
        },
        { status: 404 },
      );
    }

    // Verify signature
    const signatureResult = validateRequestSignature(
      session.signingKey,
      body.data,
      request.headers.get('x-timestamp'),
      request.headers.get('x-signature'),
    );

    if (!signatureResult.valid) {
      return jsonResponse(
        { success: false, error: signatureResult.error || 'Invalid signature' },
        { status: 401 },
      );
    }

    // Session was already touched by getSession() call above, which resets timeout
    logger.debug('Keepalive successful', { sessionId, timestamp });

    return jsonResponse({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Keepalive endpoint error', error);
    return jsonResponse(
      {
        success: false,
        error: 'Keepalive failed',
      },
      { status: 500 },
    );
  }
}
