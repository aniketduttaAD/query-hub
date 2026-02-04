import { connectionManager } from '@/lib/ConnectionManager';
import { validateRequestSignature } from '@/lib/requestSigning';
import { sanitizeErrorMessage } from '@/lib/request';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return jsonResponse({ success: false, error: 'Missing sessionId' }, { status: 400 });
  }

  const session = connectionManager.getSession(sessionId);
  if (!session) {
    return jsonResponse({ success: false, error: 'Invalid or expired session' }, { status: 401 });
  }

  try {
    const signatureResult = validateRequestSignature(
      session.signingKey,
      { sessionId },
      request.headers.get('x-timestamp'),
      request.headers.get('x-signature'),
    );
    if (!signatureResult.valid) {
      return jsonResponse(
        { success: false, error: signatureResult.error || 'Invalid request signature' },
        { status: 401 },
      );
    }

    const databases = await session.adapter.getDatabases();
    return jsonResponse({ success: true, databases });
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Failed to fetch databases',
    );
    return jsonResponse({ success: false, error: message }, { status: 400 });
  }
}
