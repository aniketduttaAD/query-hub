interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private enabled: boolean;

  constructor() {
    const enableLogging = process.env.NODE_ENV;
    this.enabled = enableLogging !== 'production';
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  private sanitizeError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    return String(error);
  }

  debug(message: string, context?: LogContext): void {
    if (!this.enabled) return;
    const formatted = this.formatMessage('DEBUG', message, context);
    if (typeof window === 'undefined') {
      process.stdout.write(formatted + '\n');
    } else {
      console.debug(formatted);
    }
  }

  info(message: string, context?: LogContext): void {
    if (!this.enabled) return;
    const formatted = this.formatMessage('INFO', message, context);
    if (typeof window === 'undefined') {
      process.stdout.write(formatted + '\n');
    } else {
      console.info(formatted);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (!this.enabled) return;
    const formatted = this.formatMessage('WARN', message, context);
    if (typeof window === 'undefined') {
      process.stderr.write(formatted + '\n');
    } else {
      console.warn(formatted);
    }
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    if (!this.enabled) return;
    const errorStr = error ? `: ${this.sanitizeError(error)}` : '';
    const formatted = this.formatMessage('ERROR', `${message}${errorStr}`, context);
    if (typeof window === 'undefined') {
      process.stderr.write(formatted + '\n');
    } else {
      console.error(formatted);
    }
  }

  logOperation(operation: string, context?: LogContext): void {
    this.info(`Operation: ${operation}`, context);
  }

  logDatabaseOperation(operation: string, database: string, context?: LogContext): void {
    this.info(`Database ${operation}`, { database, ...context });
  }
}

export const logger = new Logger();
export { Logger };
