import { getRedisClient } from './redis';
import { logger } from './logger';

const DEFAULT_TTL = 300;

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Cache get error', error, { key });
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error', error, { key });
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error', error, { key });
  }
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Cache delete pattern error', error, { pattern });
  }
}
