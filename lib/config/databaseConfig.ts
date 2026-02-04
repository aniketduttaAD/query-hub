import type { DatabaseType } from '../types';

export interface DefaultDatabaseConfig {
  type: DatabaseType;
  url: string;
  name: string;
}

export function loadDefaultDatabases(): DefaultDatabaseConfig[] {
  const databases: DefaultDatabaseConfig[] = [];

  if (process.env.DB_MONGODB_URL) {
    databases.push({
      type: 'mongodb',
      url: process.env.DB_MONGODB_URL,
      name: process.env.DB_MONGODB_NAME || 'MongoDB',
    });
  }

  if (process.env.DB_POSTGRESQL_URL) {
    databases.push({
      type: 'postgresql',
      url: process.env.DB_POSTGRESQL_URL,
      name: process.env.DB_POSTGRESQL_NAME || 'PostgreSQL',
    });
  }

  if (process.env.DB_MYSQL_URL) {
    databases.push({
      type: 'mysql',
      url: process.env.DB_MYSQL_URL,
      name: process.env.DB_MYSQL_NAME || 'MySQL',
    });
  }

  return databases;
}
