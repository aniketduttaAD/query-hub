import crypto from 'node:crypto';
import { stableStringify } from './stableStringify';

export function createSignature(signingKey: string, payload: unknown, timestamp: string): string {
  const message = `${timestamp}.${stableStringify(payload)}`;
  const key = Buffer.from(signingKey, 'hex');
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

export function isSignatureValid(
  signingKey: string,
  payload: unknown,
  timestamp: string,
  signature: string,
): boolean {
  const expected = createSignature(signingKey, payload, timestamp);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function isTimestampFresh(timestamp: string, maxSkewMs = 5 * 60 * 1000): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= maxSkewMs;
}

export function validateRequestSignature(
  signingKey: string,
  payload: unknown,
  timestamp: string | null,
  signature: string | null,
): { valid: boolean; error?: string } {
  if (!timestamp || !signature) {
    return { valid: false, error: 'Missing request signature' };
  }
  if (!isTimestampFresh(timestamp)) {
    return { valid: false, error: 'Request timestamp is invalid or expired' };
  }
  if (!isSignatureValid(signingKey, payload, timestamp, signature)) {
    return { valid: false, error: 'Invalid request signature' };
  }
  return { valid: true };
}
