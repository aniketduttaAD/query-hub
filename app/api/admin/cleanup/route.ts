import { performCleanup } from '@/lib/scheduler';
import { jsonResponse } from '@/lib/response';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_CLEANUP_TOKEN;
  if (!adminToken) {
    return jsonResponse(
      { success: false, error: 'Admin cleanup is not configured' },
      { status: 503 },
    );
  }

  const headerToken =
    request.headers.get('x-admin-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerToken || headerToken !== adminToken) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await performCleanup();
    return jsonResponse({ success: true, message: 'Cleanup completed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    return jsonResponse({ success: false, error: message }, { status: 500 });
  }
}
