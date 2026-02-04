/**
 * Centralized application constants.
 * Timeouts and limits can be overridden via environment variables where applicable.
 */

/** Session idle timeout before cleanup (ms). Default: 30 minutes. */
export const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000;

/** Interval for session cleanup check (ms). Default: 1 minute. */
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 1000;

/** Maximum allowed query length (characters). */
export const MAX_QUERY_LENGTH = Number(process.env.MAX_QUERY_LENGTH) || 100_000;

/** Maximum nested parenthesis depth in queries. */
export const MAX_NESTED_DEPTH = Number(process.env.MAX_NESTED_DEPTH) || 10;

/** Query history: max entries kept. */
export const HISTORY_MAX_ENTRIES = 100;

/** Query history: retention in days. */
export const HISTORY_RETENTION_DAYS = 2;

/** Query history: retention in milliseconds. */
export const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Redis: retry attempts when connecting. */
export const REDIS_RETRY_ATTEMPTS = Number(process.env.REDIS_RETRY_ATTEMPTS) || 3;

/** Redis: delay between retries (ms). */
export const REDIS_RETRY_DELAY_MS = Number(process.env.REDIS_RETRY_DELAY_MS) || 1000;
