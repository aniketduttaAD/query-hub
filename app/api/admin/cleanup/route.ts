import { performCleanup } from '@/lib/scheduler';
import { getClientIp } from '@/lib/request';
import { adminCleanupLimiter, rateLimitHeaders } from '@/lib/rateLimit';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

/** Only POST is allowed; prevents accidental invocation via GET (e.g. prefetch). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limitResult = await adminCleanupLimiter(ip);
  const headers = rateLimitHeaders(limitResult);

  if (!limitResult.success) {
    return jsonResponse(
      { success: false, error: 'Too many cleanup requests, try again later' },
      { status: 429, headers },
    );
  }

  const adminToken = process.env.ADMIN_CLEANUP_TOKEN;
  if (!adminToken) {
    return jsonResponse(
      { success: false, error: 'Admin cleanup is not configured' },
      { status: 503, headers },
    );
  }

  const headerToken =
    request.headers.get('x-admin-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerToken || headerToken.length === 0) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, { status: 401, headers });
  }

  try {
    const { timingSafeEqual } = await import('node:crypto');
    const a = Buffer.from(headerToken, 'utf8');
    const b = Buffer.from(adminToken, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, { status: 401, headers });
    }
  } catch {
    return jsonResponse({ success: false, error: 'Unauthorized' }, { status: 401, headers });
  }

  try {
    await performCleanup();
    return jsonResponse(
      { success: true, message: 'Cleanup completed successfully' },
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    return jsonResponse({ success: false, error: message }, { status: 500, headers });
  }
}

/** Reject GET and other methods so cleanup is never triggered by browsers/prefetch. */
export async function GET() {
  return jsonResponse({ success: false, error: 'Method not allowed' }, { status: 405 });
}
