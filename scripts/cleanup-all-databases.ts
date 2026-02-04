/**
 * Manual script to drop all user databases for PostgreSQL, MySQL, and MongoDB.
 * Uses DB_*_URL from .env (or environment). Run from project root:
 *
 *   npx tsx scripts/cleanup-all-databases.ts
 *
 * Or with node (if compiled):
 *   node --env-file=.env scripts/cleanup-all-databases.js
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgresAdapter } from '../lib/adapters/PostgresAdapter';
import { MySQLAdapter } from '../lib/adapters/MySQLAdapter';
import { MongoAdapter } from '../lib/adapters/MongoAdapter';
import { loadDefaultDatabases } from '../lib/config/databaseConfig';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      const unquoted = value.replace(/^["']|["']$/g, '');
      process.env[key] = unquoted;
    }
  }
}

async function main(): Promise<void> {
  loadEnv();

  const configs = loadDefaultDatabases();
  if (configs.length === 0) {
    console.log(
      'No DB_*_URL set in .env. Set DB_POSTGRESQL_URL, DB_MYSQL_URL, and/or DB_MONGODB_URL.',
    );
    process.exit(0);
  }

  console.log('Dropping all user databases for configured connections...\n');

  for (const db of configs) {
    try {
      if (db.type === 'postgresql') {
        const adapter = new PostgresAdapter();
        const baseUrl = new URL(db.url);
        baseUrl.pathname = '/postgres';
        await adapter.connect(baseUrl.toString());
        await adapter.dropAllUserDatabases();
        await adapter.disconnect();
        console.log(`[${db.name}] PostgreSQL: all user databases dropped.`);
      } else if (db.type === 'mysql') {
        const adapter = new MySQLAdapter();
        const baseUrl = new URL(db.url);
        baseUrl.pathname = '';
        await adapter.connect(baseUrl.toString());
        await adapter.dropAllUserDatabases();
        await adapter.disconnect();
        console.log(`[${db.name}] MySQL: all user databases dropped.`);
      } else if (db.type === 'mongodb') {
        const adapter = new MongoAdapter();
        await adapter.connect(db.url);
        await adapter.dropAllUserDatabases();
        await adapter.disconnect();
        console.log(`[${db.name}] MongoDB: all user databases dropped.`);
      }
    } catch (err) {
      console.error(`[${db.name}] Error:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\nCleanup finished.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
