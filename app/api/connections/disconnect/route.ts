import { connectionManager } from '@/lib/ConnectionManager';
import { parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { validateRequestSignature } from '@/lib/requestSigning';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await parseJsonBody<{ sessionId: string }>(request);
  if (body.error) {
    return jsonResponse({ success: false, error: body.error }, { status: body.status ?? 400 });
  }

  const { sessionId } = body.data ?? {};

  if (!sessionId) {
    return jsonResponse({ success: false, error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const session = connectionManager.getSession(sessionId);
    if (!session) {
      return jsonResponse({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    const signatureResult = validateRequestSignature(
      session.signingKey,
      body.data,
      request.headers.get('x-timestamp'),
      request.headers.get('x-signature'),
    );
    if (!signatureResult.valid) {
      return jsonResponse(
        { success: false, error: signatureResult.error || 'Invalid request signature' },
        { status: 401 },
      );
    }

    await connectionManager.closeSession(sessionId);
    return jsonResponse({ success: true });
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Disconnect failed',
    );
    return jsonResponse({ success: false, error: message }, { status: 400 });
  }
}
