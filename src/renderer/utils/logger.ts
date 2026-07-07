import type { LogWriteRequest } from '../../shared/ipc/types';

interface RendererModuleLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown, context?: Record<string, unknown>): void;
  fatal(message: string, error?: unknown, context?: Record<string, unknown>): void;
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'Error', message: String(error) };
}

function send(data: LogWriteRequest): void {
  window.api.logWrite(data).catch(() => {});
}

export function createRendererLogger(module: string): RendererModuleLogger {
  return {
    debug: (message, context) => send({ level: 'debug', module, message, context }),
    info: (message, context) => send({ level: 'info', module, message, context }),
    warn: (message, context) => send({ level: 'warn', module, message, context }),
    error: (message, error?, context?) =>
      send({ level: 'error', module, message, error: normalizeError(error), context }),
    fatal: (message, error?, context?) =>
      send({ level: 'fatal', module, message, error: normalizeError(error), context }),
  };
}
