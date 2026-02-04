import Redis from 'ioredis';
import { logger } from './logger';
import { REDIS_RETRY_ATTEMPTS, REDIS_RETRY_DELAY_MS } from './config/constants';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const globalForRedis = globalThis as unknown as {
  __redisClient?: Redis;
};

let _internalRedisClient: Redis | null = null;

function getOrCreateRedisClient(): Redis {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return new Proxy({} as Redis, {
      get() {
        return () => Promise.resolve(null);
      },
    }) as Redis;
  }

  if (_internalRedisClient) {
    return _internalRedisClient;
  }

  if (process.env.NODE_ENV === 'production') {
    _internalRedisClient =
      globalForRedis.__redisClient ??
      new Redis(REDIS_URL, {
        lazyConnect: true,
        retryStrategy: () => null,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      });
    globalForRedis.__redisClient = _internalRedisClient;
  } else {
    if (!globalForRedis.__redisClient) {
      globalForRedis.__redisClient = new Redis(REDIS_URL, {
        lazyConnect: true,
        retryStrategy: () => null,
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      });
    }
    _internalRedisClient = globalForRedis.__redisClient;
  }

  _internalRedisClient.on('error', (error) => {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      logger.error('Redis connection error', error);
    }
  });

  _internalRedisClient.on('connect', () => {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      logger.info('Redis connected successfully');
    }
  });

  return _internalRedisClient;
}

export async function getRedisClient(): Promise<Redis> {
  const client = getOrCreateRedisClient();

  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return client;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= REDIS_RETRY_ATTEMPTS; attempt++) {
    try {
      if (client.status !== 'ready' && client.status !== 'connecting') {
        await client.connect().catch(() => {});
      }
      await client.ping();
      return client;
    } catch (error) {
      lastError = error;
      logger.error('Redis connection error', error, { attempt, maxAttempts: REDIS_RETRY_ATTEMPTS });
      if (attempt < REDIS_RETRY_ATTEMPTS) {
        await sleep(REDIS_RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

let _redisClientProxy: Redis | null = null;

export const redisClient = new Proxy({} as Redis, {
  get(_target, prop) {
    if (!_redisClientProxy) {
      _redisClientProxy = getOrCreateRedisClient();
    }
    const client = _redisClientProxy;
    const value = client[prop as keyof Redis];
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
}) as Redis;
