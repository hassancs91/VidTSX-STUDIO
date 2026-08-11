import type { LogLevel, LogEntry, LogConfig, ModuleLogger } from './log-types';
import { LOG_LEVEL_PRIORITY } from './log-types';
import { LogWriter } from './log-writer';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  fatal: '\x1b[35m',
};
const RESET = '\x1b[0m';

class LogEngine {
  private config: LogConfig | null = null;
  private writer: LogWriter | null = null;
  private initialized = false;
  private crashDispatch: ((entry: LogEntry) => void) | null = null;

  /** Optional hook for crash reporting (see main/services/crash-reporting.ts).
   *  Keeps Sentry out of the log engine's own dependency graph. */
  setCrashDispatch(fn: ((entry: LogEntry) => void) | null): void {
    this.crashDispatch = fn;
  }

  async init(config: LogConfig): Promise<void> {
    if (this.initialized) return;
    this.config = config;
    this.writer = new LogWriter(config);
    await this.writer.init();
    this.initialized = true;
  }

  debug(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('debug', module, message, undefined, context);
  }

  info(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('info', module, message, undefined, context);
  }

  warn(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('warn', module, message, undefined, context);
  }

  error(module: string, message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.log('error', module, message, error, context);
  }

  fatal(module: string, message: string, error?: unknown, context?: Record<string, unknown>): void {
    this.log('fatal', module, message, error, context);
    // Immediate flush on fatal — don't lose crash context
    this.flush().catch(() => {});
  }

  ingest(entry: LogEntry): void {
    if (!this.initialized || !this.config) return;
    if (LOG_LEVEL_PRIORITY[entry.level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) return;

    this.writer?.append(entry);
    this.consoleOutput(entry);
    try {
      this.crashDispatch?.(entry);
    } catch {
      // Crash reporting must never break log ingestion.
    }
  }

  createLogger(module: string): ModuleLogger {
    return {
      debug: (message: string, context?: Record<string, unknown>) =>
        this.debug(module, message, context),
      info: (message: string, context?: Record<string, unknown>) =>
        this.info(module, message, context),
      warn: (message: string, context?: Record<string, unknown>) =>
        this.warn(module, message, context),
      error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
        this.error(module, message, error, context),
      fatal: (message: string, error?: unknown, context?: Record<string, unknown>) =>
        this.fatal(module, message, error, context),
    };
  }

  async flush(): Promise<void> {
    await this.writer?.flush();
  }

  async shutdown(): Promise<void> {
    await this.writer?.shutdown();
    this.initialized = false;
  }

  private log(
    level: LogLevel,
    module: string,
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (!this.initialized || !this.config) {
      // Fallback to console before init
      console.log(`[${module}] ${message}`);
      return;
    }

    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) return;

    const entry: LogEntry = {
      level,
      module,
      message,
      timestamp: new Date().toISOString(),
      process: 'main',
    };
    if (context) entry.context = context;
    if (error) entry.error = this.normalizeError(error);

    this.writer?.append(entry);
    this.consoleOutput(entry);
    try {
      this.crashDispatch?.(entry);
    } catch {
      // Crash reporting must never break logging.
    }
  }

  private consoleOutput(entry: LogEntry): void {
    const color = LEVEL_COLORS[entry.level];
    const prefix = `${color}[${entry.level.toUpperCase()}]${RESET} [${entry.module}]`;
    const msg = `${prefix} ${entry.message}`;

    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(msg, entry.error?.stack ?? '');
    } else if (entry.level === 'warn') {
      console.warn(msg);
    } else {
      console.log(msg);
    }
  }

  private normalizeError(error: unknown): { name: string; message: string; stack?: string } {
    if (error instanceof Error) {
      return { name: error.name, message: error.message, stack: error.stack };
    }
    return { name: 'Error', message: String(error) };
  }
}

export const logEngine = new LogEngine();
