import { ipcMain, app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { IPC } from '../shared/ipc/channels';
import { logEngine } from '../logging/log-engine';
import { UPDATE_FEED_URL, STARTUP_CHECK_DELAY_MS, CHECK_INTERVAL_MS } from './config';

let initialized = false;
let checkInterval: ReturnType<typeof setInterval> | null = null;

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function initAutoUpdater(): void {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL });

  autoUpdater.logger = {
    info: (m: unknown) => logEngine.info('Updater', String(m)),
    warn: (m: unknown) => logEngine.warn('Updater', String(m)),
    error: (m: unknown) =>
      logEngine.error('Updater', String(m), m instanceof Error ? m : new Error(String(m))),
    debug: (m: unknown) => logEngine.debug('Updater', String(m)),
  };

  autoUpdater.on('update-available', (info) => {
    broadcast(IPC.UPDATER_UPDATE_AVAILABLE, {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    broadcast(IPC.UPDATER_UP_TO_DATE, { version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcast(IPC.UPDATER_DOWNLOAD_PROGRESS, {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcast(IPC.UPDATER_UPDATE_DOWNLOADED, { version: info.version });
  });

  autoUpdater.on('error', (error) => {
    // Expected when the R2 feed isn't reachable yet — don't treat as critical.
    logEngine.info('Updater', `Update check failed (OK if R2 not configured): ${error.message}`);
    broadcast(IPC.UPDATER_ERROR, { message: error.message });
  });
}

async function safeCheck(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    logEngine.info('Updater', `checkForUpdates threw: ${(err as Error).message}`);
  }
}

export function setupAutoUpdaterIPC(): void {
  if (!app.isPackaged) {
    ipcMain.handle(IPC.UPDATER_CHECK, async () => ({ ok: false, devMode: true }));
    ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => ({ ok: false, devMode: true }));
    ipcMain.handle(IPC.UPDATER_INSTALL, async () => ({ ok: false, devMode: true }));
    ipcMain.handle(IPC.UPDATER_GET_CURRENT_VERSION, async () => ({ version: app.getVersion() }));
    logEngine.info('Updater', 'Auto-updater disabled in development mode');
    return;
  }

  initAutoUpdater();

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    await safeCheck();
    return { ok: true };
  });

  ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      logEngine.info('Updater', `downloadUpdate failed: ${(err as Error).message}`);
      return { ok: false };
    }
  });

  ipcMain.handle(IPC.UPDATER_INSTALL, async () => {
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (err) {
      logEngine.error('Updater', 'quitAndInstall failed', err as Error);
      return { ok: false };
    }
  });

  ipcMain.handle(IPC.UPDATER_GET_CURRENT_VERSION, async () => ({ version: app.getVersion() }));

  logEngine.info('Updater', 'Auto-updater IPC handlers registered');
}

export function startUpdateScheduler(_win: BrowserWindow): void {
  if (!app.isPackaged) return;
  setTimeout(() => {
    void safeCheck();
  }, STARTUP_CHECK_DELAY_MS);
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => {
    void safeCheck();
  }, CHECK_INTERVAL_MS);
}

export function stopUpdateScheduler(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
