import { app } from 'electron';
import os from 'os';
import * as Sentry from '@sentry/electron/main';
import type { LogEntry } from '../../logging/log-types';
import { logEngine } from '../../logging/log-engine';
import { getValue } from './settings-db';

// Baked in at build time. Forks/source builds without VITE_SENTRY_DSN get a
// complete no-op — nothing is initialized and nothing can ever be sent.
const DSN: string | undefined = import.meta.env.VITE_SENTRY_DSN;

// User opt-in (the first-launch prompt, then Settings > Privacy). Gates every
// outgoing event via beforeSend, so a change takes effect immediately, no restart.
let consented = false;
// Sentry.init runs exactly once per process, at boot (see initCrashReporting):
// the SDK registers an Electron protocol handler and the native crash handler,
// both of which are only possible BEFORE app 'ready', and it throws if asked
// later. Consent therefore never starts or stops the SDK; it only opens the gate.
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
    // An initialized client with consent off must make NO request. Two SDK
    // defaults would: the main-process session tracker reports app start and
    // exit on its own channel, outside beforeSend (release health is not worth
    // that, so it is dropped), and client reports would send a tally of the
    // events beforeSend dropped. Everything else that leaves the process is an
    // event and passes the gate below — minidumps included, since the default
    // SentryMinidump integration hands them to the SDK transport rather than
    // to Electron's own uploader. Verified against a local endpoint 2026-09-30.
    integrations: (defaults) => defaults.filter((i) => i.name !== 'MainProcessSession'),
    sendClientReports: false,
    beforeSend: (event) => (consented ? scrubEvent(event) : null),
    // Breadcrumbs (console output, Electron lifecycle, net) are recorded on the
    // scope regardless of beforeSend and ride along on the NEXT event — so
    // without this gate, log lines written before the user said yes would leave
    // the machine the moment they did. Found against a local endpoint 2026-09-30.
    beforeBreadcrumb: (crumb) => (consented ? crumb : null),
  });
  sentryStarted = true;
}

/** Drop whatever trail exists at a consent change: nothing recorded before "yes"
 *  may ship, and nothing recorded before "no" should linger for a later "yes". */
function clearBreadcrumbTrail(): void {
  try {
    Sentry.getCurrentScope().clearBreadcrumbs();
    Sentry.getIsolationScope().clearBreadcrumbs();
    Sentry.getGlobalScope().clearBreadcrumbs();
  } catch {
    // Scope APIs missing would mean the SDK never started; nothing to clear.
  }
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
 * Called at module top-level in main/index.ts, BEFORE app 'ready' — the only
 * moment the SDK accepts init. Without a DSN nothing starts and nothing can
 * ever be sent. With one, the SDK starts whether or not the user has consented
 * (an unconsented client is silent, see startSentry), and the opt-in flag read
 * synchronously from the settings DB decides whether events pass the gate.
 */
export function initCrashReporting(): void {
  try {
    if (!isCrashReportingAvailable()) return;
    consented = getValue<boolean>('crashReportingEnabled') === true;
    startSentry();
    logEngine.setCrashDispatch(dispatchLogEntry);
  } catch (err) {
    // eslint-disable-next-line no-console -- logging engine is not initialized yet
    console.error('[crash-reporting] init failed:', err);
  }
}

/**
 * Live toggle from the first-launch prompt or the Settings UI. Takes effect
 * immediately in both directions: JS errors and native crashes captured from
 * now on pass or fail the beforeSend gate accordingly. Nothing to start here —
 * the SDK has been running since boot (initializing it now would throw).
 */
export function setCrashReportingConsent(enabled: boolean): void {
  consented = enabled;
  if (sentryStarted) clearBreadcrumbTrail();
}
