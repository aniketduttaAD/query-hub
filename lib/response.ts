import { gzipSync } from 'node:zlib';

const DEFAULT_COMPRESSION_THRESHOLD = 200_000;

export function jsonResponse(
  payload: unknown,
  init: {
    status?: number;
    headers?: Headers | Record<string, string> | [string, string][];
    compress?: boolean;
  } = {},
): Response {
  const body = JSON.stringify(payload);
  const headers = new Headers(init.headers);

  if (init.compress && body.length > DEFAULT_COMPRESSION_THRESHOLD) {
    const compressed = gzipSync(body);
    headers.set('Content-Type', 'application/json');
    headers.set('Content-Encoding', 'gzip');
    return new Response(compressed, { status: init.status, headers });
  }

  headers.set('Content-Type', 'application/json');
  return new Response(body, { status: init.status, headers });
}
