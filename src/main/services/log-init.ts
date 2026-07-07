import { app } from 'electron';
import path from 'path';
import * as Sentry from '@sentry/electron/main';
import { logEngine } from '../../logging/log-engine';
import type { LogConfig } from '../../logging/log-types';

/**
 * Must be called BEFORE app.whenReady() — Sentry requires early init.
 */
export function initSentry(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      release: `vidtsx-studio@${app.getVersion()}`,
      environment: app.isPackaged ? 'production' : 'development',
    });
  }
}

/**
 * Called after app.whenReady() — sets up file logging + log engine.
 */
export async function initLogging(): Promise<void> {
  const logDir = path.join(app.getPath('userData'), 'logs');
  const isDev = !app.isPackaged;
  const appVersion = app.getVersion();
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  const config: LogConfig = {
    minLevel: isDev ? 'debug' : 'info',
    logDir,
    maxFileSizeMB: 10,
    maxAgeDays: 14,
    flushIntervalMs: 1000,
    sentryDsn,
    sentryEnabled: !!sentryDsn,
    environment: isDev ? 'development' : 'production',
    appVersion,
  };

  await logEngine.init(config);

  const log = logEngine.createLogger('Logging');
  log.info('Logging engine initialized', {
    logDir,
    minLevel: config.minLevel,
    sentryEnabled: config.sentryEnabled,
  });}
