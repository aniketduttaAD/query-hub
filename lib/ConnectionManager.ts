import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { DatabaseAdapter, DatabaseType, Session } from './types';
import { PostgresAdapter, MongoAdapter, MySQLAdapter } from './adapters';
import { logger } from './logger';

class ConnectionManager {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, string> = new Map();
  private sessionTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // Sessions stay alive indefinitely while tab is open with keepalive
  // Only timeout if no activity for 2 hours (covers tab sleep/suspend scenarios)
  private readonly SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
  private readonly SESSION_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  async createSession(
    type: DatabaseType,
    connectionUrl: string,
    userId?: string,
    isIsolated: boolean = false,
    isDefaultConnection: boolean = false,
  ): Promise<{
    sessionId: string;
    serverVersion: string;
    signingKey: string;
    userDatabase?: string;
  }> {
    if (userId) {
      const previousSessionId = this.userSessions.get(userId);
      if (previousSessionId) {
        await this.closeSession(previousSessionId);
      }
    }

    let adapter: DatabaseAdapter;
    let userDatabase: string | undefined;

    switch (type) {
      case 'postgresql':
        adapter = new PostgresAdapter();
        break;
      case 'mongodb':
        adapter = new MongoAdapter();
        break;
      case 'mysql':
        adapter = new MySQLAdapter();
        break;
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    if (isIsolated && userId) {
      const hash = createHash('sha256').update(userId).digest('hex').substring(0, 32);
      userDatabase = `u_${hash}`;

      try {
        if (type === 'mongodb') {
          await adapter.connect(connectionUrl);
        } else if (type === 'postgresql') {
          const baseUrl = new URL(connectionUrl);
          baseUrl.pathname = '/postgres';

          const tempAdapter = new PostgresAdapter();
          await tempAdapter.connect(baseUrl.toString());

          try {
            const pool = (tempAdapter as unknown as { pool: import('pg').Pool | null }).pool;
            if (pool) {
              const client = await pool.connect();
              try {
                const checkResult = await client.query(
                  `SELECT 1 FROM pg_database WHERE datname = $1`,
                  [userDatabase],
                );

                if (checkResult.rowCount === 0) {
                  await client.query(`CREATE DATABASE "${userDatabase}"`);
                }
              } finally {
                client.release();
              }
            }
          } catch (error) {
            logger.debug('Database might already exist or creation failed', {
              database: userDatabase,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          await tempAdapter.disconnect();

          const userUrl = new URL(connectionUrl);
          userUrl.pathname = `/${userDatabase}`;
          await adapter.connect(userUrl.toString());
        } else if (type === 'mysql') {
          const baseUrl = new URL(connectionUrl);
          baseUrl.pathname = '';

          const tempAdapter = new MySQLAdapter();
          await tempAdapter.connect(baseUrl.toString());

          try {
            await tempAdapter.executeQuery(
              `CREATE DATABASE IF NOT EXISTS \`${userDatabase}\``,
              undefined,
            );
          } catch (error) {
            logger.error('Failed to create MySQL database', error, { database: userDatabase });
          }

          await tempAdapter.disconnect();

          const userUrl = new URL(connectionUrl);
          userUrl.pathname = `/${userDatabase}`;
          await adapter.connect(userUrl.toString());
        }
      } catch (error) {
        logger.error('Failed to create user database', error, { database: userDatabase, type });

        await adapter.connect(connectionUrl);
        userDatabase = undefined;
      }
    } else {
      await adapter.connect(connectionUrl);
    }

    const serverVersion = await adapter.getServerVersion();
    const signingKey = randomBytes(32).toString('hex');

    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      id: sessionId,
      adapter,
      type,
      createdAt: new Date(),
      lastActivity: new Date(),
      signingKey,
      userId,
      isIsolated,
      isDefaultConnection,
      userDatabase,
    });

    if (userId) {
      this.userSessions.set(userId, sessionId);
    }

    this.resetSessionTimeout(sessionId);

    if (!this.cleanupInterval) {
      this.startCleanupInterval();
    }

    logger.info('Session created', { sessionId, type, userId, userDatabase });
    return { sessionId, serverVersion, signingKey, userDatabase };
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.resetSessionTimeout(sessionId);
    }
    return session;
  }

  private resetSessionTimeout(sessionId: string): void {
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.handleSessionTimeout(sessionId);
    }, this.SESSION_IDLE_TIMEOUT_MS);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  private async handleSessionTimeout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const idleTime = Date.now() - session.lastActivity.getTime();

    if (idleTime >= this.SESSION_IDLE_TIMEOUT_MS) {
      logger.info('Session timed out due to inactivity', {
        sessionId,
        idleMinutes: Math.floor(idleTime / 60000),
      });
      await this.closeSession(sessionId);
    }
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, this.SESSION_CLEANUP_INTERVAL_MS);

    logger.info('Session cleanup interval started');
  }

  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Session cleanup interval stopped');
    }
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.lastActivity.getTime();
      if (idleTime >= this.SESSION_IDLE_TIMEOUT_MS) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      logger.info('Cleaning up idle session', { sessionId });
      await this.closeSession(sessionId);
    }
  }

  setSessionAllowDestructive(sessionId: string, allow: boolean): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isDefaultConnection) return false;
    session.allowDestructive = allow;
    session.lastActivity = new Date();
    return true;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const existingTimeout = this.sessionTimeouts.get(sessionId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.sessionTimeouts.delete(sessionId);
      }

      try {
        await session.adapter.disconnect();
      } catch (error) {
        logger.error('Error closing session', error, { sessionId });
      }
      this.sessions.delete(sessionId);

      if (session.userId) {
        const currentSessionId = this.userSessions.get(session.userId);
        if (currentSessionId === sessionId) {
          this.userSessions.delete(session.userId);
        }
      }

      logger.info('Session closed', { sessionId });

      if (this.sessions.size === 0) {
        this.stopCleanupInterval();
      }
    }
  }

  getSessionByUserId(userId: string): Session | undefined {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      return this.getSession(sessionId);
    }
    return undefined;
  }

  async closeAllSessions(): Promise<void> {
    this.stopCleanupInterval();

    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.sessionTimeouts.clear();

    for (const [id] of this.sessions) {
      await this.closeSession(id);
    }
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    idleSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let idleSessions = 0;

    for (const session of this.sessions.values()) {
      const idleTime = now - session.lastActivity.getTime();
      if (idleTime < 5 * 60 * 1000) {
        activeSessions++;
      } else {
        idleSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      idleSessions,
    };
  }
}

const globalForConnectionManager = globalThis as unknown as {
  __connectionManager?: ConnectionManager;
  __connectionManagerHandlersRegistered?: boolean;
};

export const connectionManager =
  globalForConnectionManager.__connectionManager ?? new ConnectionManager();

globalForConnectionManager.__connectionManager = connectionManager;

if (!globalForConnectionManager.__connectionManagerHandlersRegistered) {
  globalForConnectionManager.__connectionManagerHandlersRegistered = true;

  const shutdown = async () => {
    try {
      await connectionManager.closeAllSessions();
    } catch (error) {
      logger.error('Error during graceful shutdown', error);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
