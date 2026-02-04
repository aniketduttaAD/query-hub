import { getRedisClient } from './redis';
import { logger } from './logger';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  windowMs: number;
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

async function getRateLimitRecord(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  key: string,
): Promise<{ count: number; resetTime: number } | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as { count: number; resetTime: number };
  } catch {
    return null;
  }
}

async function setRateLimitRecord(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  key: string,
  count: number,
  resetTime: number,
): Promise<void> {
  try {
    const ttl = Math.ceil((resetTime - Date.now()) / 1000);
    await redis.setex(key, Math.max(ttl, 1), JSON.stringify({ count, resetTime }));
  } catch (error) {
    logger.error('Failed to set rate limit record', error, { key });
  }
}

export function createRateLimiter(options: RateLimiterOptions) {
  return async function limit(key: string): Promise<RateLimitResult> {
    try {
      const redis = await getRedisClient();
      const now = Date.now();
      const bucketKey = `${options.keyPrefix}:${key}`;
      const record = await getRateLimitRecord(redis, bucketKey);

      if (!record || now > record.resetTime) {
        const resetTime = now + options.windowMs;
        await setRateLimitRecord(redis, bucketKey, 1, resetTime);
        return {
          success: true,
          limit: options.max,
          remaining: options.max - 1,
          resetTime,
          windowMs: options.windowMs,
        };
      }

      if (record.count >= options.max) {
        return {
          success: false,
          limit: options.max,
          remaining: 0,
          resetTime: record.resetTime,
          windowMs: options.windowMs,
        };
      }

      const newCount = record.count + 1;
      await setRateLimitRecord(redis, bucketKey, newCount, record.resetTime);

      return {
        success: true,
        limit: options.max,
        remaining: options.max - newCount,
        resetTime: record.resetTime,
        windowMs: options.windowMs,
      };
    } catch (error) {
      logger.error('Rate limiting error, allowing request', error, { key });

      return {
        success: true,
        limit: options.max,
        remaining: options.max,
        resetTime: Date.now() + options.windowMs,
        windowMs: options.windowMs,
      };
    }
  };
}

export function rateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  const windowSeconds = Math.ceil(result.windowMs / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
  headers.set('RateLimit-Limit', result.limit.toString());
  headers.set('RateLimit-Remaining', Math.max(result.remaining, 0).toString());
  headers.set('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
  headers.set('RateLimit-Policy', `${result.limit};w=${windowSeconds}`);
  if (!result.success) {
    headers.set('Retry-After', retryAfterSeconds.toString());
  }
  return headers;
}

const readPositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const queryLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: readPositiveInt(process.env.RATE_LIMIT_QUERY_MAX, 100),
  keyPrefix: 'query',
});

export const connectionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: readPositiveInt(process.env.RATE_LIMIT_CONNECTION_MAX, 20),
  keyPrefix: 'connection',
});
