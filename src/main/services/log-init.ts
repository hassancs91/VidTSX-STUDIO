import { app } from 'electron';
import path from 'path';
import { logEngine } from '../../logging/log-engine';
import type { LogConfig } from '../../logging/log-types';

/**
 * Called after app.whenReady() — sets up file logging + log engine.
 */
export async function initLogging(): Promise<void> {
  const logDir = path.join(app.getPath('userData'), 'logs');
  const isDev = !app.isPackaged;
  const appVersion = app.getVersion();

  const config: LogConfig = {
    minLevel: isDev ? 'debug' : 'info',
    logDir,
    maxFileSizeMB: 10,
    maxAgeDays: 14,
    flushIntervalMs: 1000,
    environment: isDev ? 'development' : 'production',
    appVersion,
  };

  await logEngine.init(config);

  const log = logEngine.createLogger('Logging');
  log.info('Logging engine initialized', {
    logDir,
    minLevel: config.minLevel,
  });
}
