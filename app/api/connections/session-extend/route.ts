import { connectionManager } from '@/lib/ConnectionManager';
import { parseJsonBody } from '@/lib/request';
import { validateRequestSignature } from '@/lib/requestSigning';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

const UNAUTH = { success: false, error: 'Invalid or expired session' } as const;
const STATUS_UNAUTH = 401;

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.APP_EXTEND_CODE;
    if (!secret || secret.length < 8) {
      return jsonResponse(UNAUTH, { status: 404 });
    }
    const code = request.headers.get('x-request-code') ?? '';
    if (!safeCompare(code, secret)) {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    const body = await parseJsonBody<{ sessionId: string }>(request);
    if (body.error || !body.data) {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    const sessionId = body.data.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    const session = connectionManager.getSession(sessionId);
    if (!session?.signingKey) {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    try {
      const sig = validateRequestSignature(
        session.signingKey,
        body.data,
        request.headers.get('x-timestamp'),
        request.headers.get('x-signature'),
      );
      if (!sig.valid) {
        return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
      }
    } catch {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    const updated = connectionManager.setSessionAllowDestructive(sessionId, true);
    if (!updated) {
      return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse(UNAUTH, { status: STATUS_UNAUTH });
  }
}
