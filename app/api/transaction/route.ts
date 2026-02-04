import { connectionManager } from '@/lib/ConnectionManager';
import { parseJsonBody, sanitizeErrorMessage } from '@/lib/request';
import { validateRequestSignature } from '@/lib/requestSigning';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

interface TransactionBody {
  sessionId: string;
  action: 'begin' | 'commit' | 'rollback';
}

export async function POST(request: Request) {
  const body = await parseJsonBody<TransactionBody>(request);
  if (body.error) {
    return jsonResponse({ success: false, error: body.error }, { status: body.status ?? 400 });
  }

  const { sessionId, action } = body.data ?? {};
  if (!sessionId || !action) {
    return jsonResponse({ success: false, error: 'Missing sessionId or action' }, { status: 400 });
  }

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

  try {
    if (action === 'begin') {
      await session.adapter.beginTransaction();
    } else if (action === 'commit') {
      await session.adapter.commitTransaction();
    } else if (action === 'rollback') {
      await session.adapter.rollbackTransaction();
    } else {
      return jsonResponse(
        { success: false, error: 'Unsupported transaction action' },
        { status: 400 },
      );
    }

    return jsonResponse({ success: true, active: session.adapter.isTransactionActive() });
  } catch (error) {
    const message = sanitizeErrorMessage(
      error instanceof Error ? error.message : 'Transaction request failed',
    );
    return jsonResponse({ success: false, error: message }, { status: 400 });
  }
}
