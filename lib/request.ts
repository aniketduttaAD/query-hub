const MAX_BODY_BYTES = 1_000_000;

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

export async function parseJsonBody<T>(
  request: Request,
): Promise<{ data?: T; error?: string; status?: number }> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > MAX_BODY_BYTES) {
    return { error: 'Request body too large', status: 413 };
  }

  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return { error: 'Invalid JSON body', status: 400 };
  }
}

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/:[^@]+@/g, ':****@')
    .replace(/(password|pwd|pass)=([^&\s]+)/gi, '$1=****')
    .replace(/mongodb:\/\/[^@]+@/gi, 'mongodb://****@')
    .replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://****@')
    .replace(/mysql:\/\/[^@]+@/gi, 'mysql://****@')
    .replace(/(user|username|userid)=([^&\s]+)/gi, '$1=****');
}
