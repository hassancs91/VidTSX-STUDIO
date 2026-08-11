import { app } from 'electron';
import os from 'os';
import * as Sentry from '@sentry/electron/main';
import type { LogEntry } from '../../logging/log-types';
import { logEngine } from '../../logging/log-engine';
import { getValue } from './settings-db';

// Baked in at build time. Forks/source builds without VITE_SENTRY_DSN get a
// complete no-op — nothing is initialized and nothing can ever be sent.
const DSN: string | undefined = import.meta.env.VITE_SENTRY_DSN;

// User opt-in (Settings > Privacy). Gates every outgoing event via beforeSend,
// so flipping it off mid-session takes effect immediately.
let consented = false;
// Sentry.init must only run once per process; re-enabling after a disable
// reuses the already-initialized client and just lifts the beforeSend gate.
let sentryStarted = false;

export function isCrashReportingAvailable(): boolean {
  return typeof DSN === 'string' && DSN.length > 0;
}

/** Strip usernames from filesystem paths anywhere in a string. */
function scrubString(value: string): string {
  let out = value
    .replace(/([A-Za-z]:[\\/]Users[\\/])[^\\/]+/g, '$1[user]')
    .replace(/((?:^|[\s"'(])\/(?:home|Users)\/)[^\\/]+/g, '$1[user]');
  const username = os.userInfo().username;
  if (username.length >= 3) {
    out = out.split(username).join('[user]');
  }
  return out;
}

function deepScrub(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => deepScrub(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepScrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubEvent<E extends Sentry.Event>(event: E): E | null {
  try {
    return deepScrub(event) as E;
  } catch {
    // If scrubbing fails for any reason, drop the event rather than risk
    // leaking a path — privacy over completeness.
    return null;
  }
}

function startSentry(): void {
  if (sentryStarted || !DSN) return;
  Sentry.init({
    dsn: DSN,
    release: `vidtsx-studio@${app.getVersion()}`,
    environment: app.isPackaged ? 'production' : 'development',
    sendDefaultPii: false,
    beforeSend: (event) => (consented ? scrubEvent(event) : null),
  });
  sentryStarted = true;
}

/**
 * Map log-engine entries to Sentry: warn → breadcrumb, error/fatal → event.
 * Registered as the log engine's crash dispatch so both main-process logs and
 * renderer-forwarded logs flow through without a second reporting path.
 */
function dispatchLogEntry(entry: LogEntry): void {
  if (!consented || !sentryStarted) return;
  try {
    if (entry.level === 'warn') {
      Sentry.addBreadcrumb({
        category: entry.module,
        message: entry.message,
        level: 'warning',
      });
      return;
    }
    if (entry.level !== 'error' && entry.level !== 'fatal') return;
    const tags = { module: entry.module, process: entry.process };
    if (entry.error) {
      const err = new Error(entry.error.message);
      err.name = entry.error.name;
      if (entry.error.stack) err.stack = entry.error.stack;
      Sentry.captureException(err, { tags, extra: { logMessage: entry.message, ...entry.context } });
    } else {
      Sentry.captureMessage(entry.message, {
        level: entry.level === 'fatal' ? 'fatal' : 'error',
        tags,
        extra: entry.context,
      });
    }
  } catch {
    // Reporting must never break logging.
  }
}

/**
 * Called at module top-level in main/index.ts — Sentry's native crash handler
 * must be installed BEFORE app 'ready'. Reads the opt-in flag synchronously
 * from the settings DB; without consent (or without a DSN) nothing starts.
 */
export function initCrashReporting(): void {
  try {
    if (!isCrashReportingAvailable()) return;
    consented = getValue<boolean>('crashReportingEnabled') === true;
    if (consented) startSentry();
    logEngine.setCrashDispatch(dispatchLogEntry);
  } catch (err) {
    // eslint-disable-next-line no-console -- logging engine is not initialized yet
    console.error('[crash-reporting] init failed:', err);
  }
}

/**
 * Live toggle from the Settings UI. Enabling mid-session starts JS error
 * capture immediately; the native crash handler completes on next launch.
 */
export function setCrashReportingConsent(enabled: boolean): void {
  consented = enabled;
  if (enabled) startSentry();
}
