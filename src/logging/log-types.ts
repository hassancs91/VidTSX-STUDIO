export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  module: string;
  timestamp: string;
  process: 'main' | 'renderer';
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface LogConfig {
  minLevel: LogLevel;
  logDir: string;
  maxFileSizeMB: number;
  maxAgeDays: number;
  flushIntervalMs: number;
  sentryDsn?: string;
  sentryEnabled: boolean;
  environment: string;
  appVersion: string;
}

export interface ModuleLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: unknown, context?: Record<string, unknown>): void;
}
