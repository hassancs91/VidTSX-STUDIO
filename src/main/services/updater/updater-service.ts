/**
 * Auto-update engine. Wraps electron-updater in a single serialisable state object
 * that main pushes to the renderer on every transition.
 *
 * Design notes (docs/auto-update-plan.md):
 *  - We never auto-install mid-session. `autoInstallOnAppQuit` applies a staged
 *    update on the next normal quit; the user chooses when to restart.
 *  - `autoDownload` is driven by our own setting, not electron-updater's, so a
 *    manual "Download" click works even when background downloads are off.
 *  - Background checks stay silent on failure; user-triggered ones always answer.
 */

import { app, BrowserWindow } from 'electron';
import { autoUpdater, CancellationToken, type UpdateInfo } from 'electron-updater';
import { IPC } from '../../../shared/ipc/channels';
import type {
  UpdateChannel,
  UpdateCheckTrigger,
  UpdaterState,
} from '../../../shared/ipc/types';
import { logEngine } from '../../../logging/log-engine';
import {
  getUpdateAutoDownload,
  getUpdateChannel,
  getUpdateSkippedVersion,
  setUpdateAutoDownload,
  setUpdateChannel,
  setUpdateSkippedVersion,
} from '../settings';
import { getUpdateBlockers } from './update-gate';
import { normalizeReleaseNotes } from './release-notes';

/** Delay after launch before the first check — keeps startup I/O clean. */
const FIRST_CHECK_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** While an update sits staged, re-evaluate the busy gate at this cadence. */
const BLOCKER_POLL_MS = 30_000;

let mainWindow: BrowserWindow | null = null;
let initialized = false;
let downloadToken: CancellationToken | null = null;
let blockerTimer: ReturnType<typeof setInterval> | null = null;
let firstCheckTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

let state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  progress: null,
  error: null,
  lastCheckedAt: null,
  lastCheckTrigger: 'auto',
  unsupportedReason: null,
  channel: 'stable',
  autoDownload: true,
  installing: false,
  blockers: [],
  skippedVersion: null,
};

export function getUpdaterState(): UpdaterState {
  return state;
}

function push(patch: Partial<UpdaterState>): void {
  state = { ...state, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.UPDATER_STATE, { state });
  }
}

function markUnsupported(reason: string): void {
  push({ status: 'unsupported', unsupportedReason: reason });
  logEngine.info('Updater', `Auto-update unavailable: ${reason}`);
}

/** Turns updater/network failures into sentences a non-technical user can act on. */
function toUserMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ETIMEDOUT/i.test(raw)) {
    return "Couldn't reach the update server. Check your internet connection and try again.";
  }
  if (/404/.test(raw)) {
    return 'No published release was found for this build channel.';
  }
  if (/sha512|checksum|signature/i.test(raw)) {
    return 'The downloaded update failed its integrity check and was discarded. Try again.';
  }
  if (/EACCES|EPERM/i.test(raw)) {
    return 'Permission denied while writing the update. Try running the app again, or reinstall manually.';
  }
  return raw;
}

async function refreshBlockers(): Promise<void> {
  const blockers = await getUpdateBlockers();
  const changed =
    blockers.length !== state.blockers.length ||
    blockers.some((reason, index) => reason !== state.blockers[index]);
  if (changed) push({ blockers });
}

function startBlockerPolling(): void {
  if (blockerTimer) return;
  blockerTimer = setInterval(() => {
    void refreshBlockers();
  }, BLOCKER_POLL_MS);
}

function stopBlockerPolling(): void {
  if (blockerTimer) {
    clearInterval(blockerTimer);
    blockerTimer = null;
  }
}

function wireEvents(): void {
  autoUpdater.on('checking-for-update', () => {
    push({ status: 'checking', error: null });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    push({
      status: 'available',
      availableVersion: info.version,
      releaseNotes: normalizeReleaseNotes(info),
      releaseDate: info.releaseDate ?? null,
      lastCheckedAt: Date.now(),
      error: null,
    });
    logEngine.info('Updater', `Update available: ${info.version} (current ${state.currentVersion})`);
    void maybeAutoDownload();
  });

  autoUpdater.on('update-not-available', () => {
    push({
      status: 'not-available',
      availableVersion: null,
      progress: null,
      lastCheckedAt: Date.now(),
      error: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    push({
      status: 'downloading',
      progress: {
        percent: progress.percent ?? 0,
        bytesPerSecond: progress.bytesPerSecond ?? 0,
        transferred: progress.transferred ?? 0,
        total: progress.total ?? 0,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    downloadToken = null;
    push({
      status: 'downloaded',
      availableVersion: info.version,
      releaseNotes: normalizeReleaseNotes(info),
      progress: null,
      error: null,
    });
    logEngine.info('Updater', `Update ${info.version} staged — will install on restart or next quit`);
    void refreshBlockers();
    startBlockerPolling();
  });

  autoUpdater.on('error', (error) => {
    const wasDownloading = state.status === 'downloading' || downloadToken !== null;
    downloadToken = null;
    const message = toUserMessage(error);
    // A silent background failure is not the user's problem; a manual check must answer.
    push({
      status: 'error',
      error: message,
      progress: null,
      lastCheckedAt: Date.now(),
    });
    // Error-level entries become crash-report events for users who opted in. A
    // failed CHECK is routine (offline, GitHub unreachable, rate-limited) and would
    // report twice per launch for every such user — a warning (breadcrumb) is the
    // right weight. A failed DOWNLOAD is rare and worth an event.
    if (wasDownloading) {
      logEngine.error('Updater', 'Update download failed', error);
    } else {
      logEngine.warn('Updater', `Update check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

async function maybeAutoDownload(): Promise<void> {
  if (!state.autoDownload) return;
  // A background check must not re-download a version the user explicitly skipped.
  if (state.lastCheckTrigger === 'auto' && state.availableVersion === state.skippedVersion) return;
  await downloadUpdate();
}

export async function checkForUpdates(trigger: UpdateCheckTrigger = 'manual'): Promise<UpdaterState> {
  if (state.status === 'unsupported') return state;
  if (state.status === 'checking' || state.status === 'downloading') return state;
  // An update is already staged. Re-checking would overwrite 'downloaded' with
  // 'available'/'not-available' and silently retract the restart chip.
  if (state.status === 'downloaded' || state.installing) return state;

  push({ lastCheckTrigger: trigger });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    // The 'error' event already pushed a user-facing message; this catch only
    // stops the rejection from escaping into an unhandled promise.
    logEngine.warn('Updater', `checkForUpdates threw: ${error instanceof Error ? error.message : String(error)}`);
  }
  return state;
}

export async function downloadUpdate(): Promise<{ success: boolean; error?: string }> {
  if (state.status === 'downloading') return { success: true };
  if (state.status === 'downloaded') return { success: true };
  if (!state.availableVersion) return { success: false, error: 'No update is available to download.' };

  try {
    downloadToken = new CancellationToken();
    push({ status: 'downloading', progress: null, error: null });
    await autoUpdater.downloadUpdate(downloadToken);
    return { success: true };
  } catch (error) {
    downloadToken = null;
    const message = toUserMessage(error);
    push({ status: 'error', error: message, progress: null });
    return { success: false, error: message };
  }
}

/**
 * Aborts an in-flight download. Partially transferred bytes stay in the updater
 * cache, so resuming later does not restart from zero.
 */
export function cancelDownload(): boolean {
  if (!downloadToken) return false;
  downloadToken.cancel();
  downloadToken = null;
  push({ status: 'available', progress: null });
  return true;
}

export async function setPrefs(prefs: {
  autoDownload?: boolean;
  channel?: UpdateChannel;
  skipVersion?: string | null;
}): Promise<UpdaterState> {
  if (typeof prefs.autoDownload === 'boolean') {
    await setUpdateAutoDownload(prefs.autoDownload);
    push({ autoDownload: prefs.autoDownload });
  }
  if (prefs.skipVersion !== undefined) {
    await setUpdateSkippedVersion(prefs.skipVersion);
    push({ skippedVersion: prefs.skipVersion });
  }
  if (prefs.channel && prefs.channel !== state.channel) {
    await setUpdateChannel(prefs.channel);
    autoUpdater.allowPrerelease = prefs.channel === 'beta';
    push({ channel: prefs.channel });
    // Switching channels changes what "latest" means — answer immediately rather
    // than leaving the user staring at a stale result for up to six hours.
    if (state.status !== 'unsupported') await checkForUpdates('manual');
  }
  return state;
}

/**
 * Quits and installs. Awaits full teardown first so the installer can never race
 * SQLite's WAL merge — see services/shutdown.ts.
 */
export async function installUpdate(): Promise<{
  success: boolean;
  reason?: 'busy' | 'not-ready' | 'unsupported';
  blockers?: string[];
  error?: string;
}> {
  if (state.status === 'unsupported') return { success: false, reason: 'unsupported' };
  if (state.status !== 'downloaded') return { success: false, reason: 'not-ready' };

  const blockers = await getUpdateBlockers();
  if (blockers.length > 0) {
    push({ blockers });
    return { success: false, reason: 'busy', blockers };
  }

  push({ installing: true });
  logEngine.info('Updater', `Installing ${state.availableVersion} — shutting down`);

  try {
    const { gracefulShutdown } = await import('../shutdown');
    await gracefulShutdown();
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  } catch (error) {
    push({ installing: false });
    const message = toUserMessage(error);
    logEngine.error('Updater', 'Install failed', error);
    return { success: false, error: message };
  }
}

export function initUpdater(win: BrowserWindow): void {
  if (initialized) return;
  initialized = true;
  mainWindow = win;

  void (async () => {
    const [autoDownload, channel, skippedVersion] = await Promise.all([
      getUpdateAutoDownload(),
      getUpdateChannel(),
      getUpdateSkippedVersion(),
    ]);
    push({ autoDownload, channel, skippedVersion });

    // Dev builds have no packaged app to replace. VIDTSX_DEV_UPDATE=1 plus a
    // dev-app-update.yml lets the full flow be exercised from `npm run dev`.
    const devUpdateForced = process.env.VIDTSX_DEV_UPDATE === '1';
    if (!app.isPackaged && !devUpdateForced) {
      markUnsupported('Automatic updates are disabled in development builds.');
      return;
    }

    // Squirrel.Mac refuses unsigned updates, so there is nothing to offer until
    // Developer ID signing + notarization land (docs/auto-update-plan.md §8).
    if (process.platform === 'darwin') {
      markUnsupported('Automatic updates on macOS require a signed build. Download the latest version from GitHub.');
      return;
    }

    // electron-updater's own logger: its "error" lines duplicate what the 'error'
    // event above already classifies, so they stay warnings (breadcrumbs), never
    // crash-report events of their own.
    autoUpdater.logger = {
      info: (message?: unknown) => logEngine.info('Updater', String(message)),
      warn: (message?: unknown) => logEngine.warn('Updater', String(message)),
      error: (message?: unknown) => logEngine.warn('Updater', String(message)),
    };
    autoUpdater.autoDownload = false; // driven by our own setting instead
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = channel === 'beta';
    if (devUpdateForced) autoUpdater.forceDevUpdateConfig = true;

    wireEvents();

    firstCheckTimer = setTimeout(() => void checkForUpdates('auto'), FIRST_CHECK_DELAY_MS);
    pollTimer = setInterval(() => void checkForUpdates('auto'), CHECK_INTERVAL_MS);
  })();
}

export function disposeUpdater(): void {
  if (firstCheckTimer) {
    clearTimeout(firstCheckTimer);
    firstCheckTimer = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopBlockerPolling();
  mainWindow = null;
}
