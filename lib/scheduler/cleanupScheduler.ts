import * as cron from 'node-cron';
import { loadDefaultDatabases } from '../config/databaseConfig';
import { MongoAdapter, PostgresAdapter, MySQLAdapter } from '../adapters';
import { logger } from '../logger';

let cleanupJob: cron.ScheduledTask | null = null;

async function performCleanup() {
  logger.info('Starting daily database cleanup (drop all user databases)');

  const defaultDatabases = loadDefaultDatabases();

  for (const dbConfig of defaultDatabases) {
    try {
      logger.logDatabaseOperation('cleanup started', dbConfig.name, { type: dbConfig.type });

      if (dbConfig.type === 'postgresql') {
        const adapter = new PostgresAdapter();
        const baseUrl = new URL(dbConfig.url);
        baseUrl.pathname = '/postgres';
        await adapter.connect(baseUrl.toString());
        try {
          await adapter.dropAllUserDatabases();
        } finally {
          await adapter.disconnect();
        }
        continue;
      }

      if (dbConfig.type === 'mongodb') {
        const adapter = new MongoAdapter();
        await adapter.connect(dbConfig.url);
        try {
          await adapter.dropAllUserDatabases();
        } finally {
          await adapter.disconnect();
        }
        continue;
      }

      if (dbConfig.type === 'mysql') {
        const adapter = new MySQLAdapter();
        const baseUrl = new URL(dbConfig.url);
        baseUrl.pathname = '';
        await adapter.connect(baseUrl.toString());
        try {
          await adapter.dropAllUserDatabases();
        } finally {
          await adapter.disconnect();
        }
        continue;
      }
    } catch (error) {
      logger.error('Failed to cleanup database', error, {
        type: dbConfig.type,
        name: dbConfig.name,
      });
    }
  }

  logger.info('Daily database cleanup completed');
}

export { performCleanup };

export function startCleanupScheduler() {
  if (cleanupJob) {
    logger.warn('Cleanup scheduler already running');
    return;
  }

  cleanupJob = cron.schedule('0 2 * * *', performCleanup, {
    scheduled: true,
    timezone: 'UTC',
  });

  logger.info('Cleanup scheduler started - will run daily at 2:00 AM UTC');
}

export function stopCleanupScheduler() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    logger.info('Cleanup scheduler stopped');
  }
}

if (typeof window === 'undefined') {
  startCleanupScheduler();
}
