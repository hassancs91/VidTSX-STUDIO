import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { registerAllIPC } from './ipc/register';
import { installQuitFlushGuard } from './ipc/flush-guard';
import { ensureProjectsDir } from './utils/paths';
import { initLLMEngine } from './services/llm-init';
import { initImageEngine } from './services/image-init';
import { initSttEngine } from './services/stt/stt-init';
import { initSdImageCategory } from './services/sdimage-init';
import { initSdVideoCategory } from './services/sdvideo-init';
import { initAiRuntime } from './services/ai-runtime';
import { registerThreedCategory } from './services/python-models/threed-category';
import { initLogging } from './services/log-init';
import { initCrashReporting } from './services/crash-reporting';
import { migrateImageStudio } from './services/image-studio-migrate';
import { migrateVideoStudio } from './services/video-studio-migrate';
import { migrateTranscriptionProjects } from './services/transcription-projects-migrate';
import { migrateRenderQueue } from './services/render-queue-migrate';
import { migrateSettings, migrateProviderSettings } from './services/settings-migrate';
import { migrateSensitiveSettings } from './services/settings-db';
import { migrateAiUsage } from './services/ai-usage-migrate';
import { migrateFlowsProjects } from './services/flows-projects-migrate';
import { migrateDownloads } from './services/download-manager/download-state-migrate';
import { initSystemMonitor } from './services/system-monitor';
import { initDownloadEngine, restoreDownloads } from './services/download-manager';
import { initUpdater } from './services/updater/updater-service';
import { gracefulShutdown } from './services/shutdown';
import {
  hasPendingPackage,
  packagePathFromArgv,
  setPendingPackage,
} from './services/studio/package-open';
import { IPC } from '../shared/ipc/channels';
import { logEngine } from '../logging/log-engine';

// Enable hardware acceleration for better rendering performance
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Single-instance lock — second launches focus the existing window instead of spawning a duplicate
// (matters here because a duplicate spawns a second Python sidecar and fights over the workspace).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  // eslint-disable-next-line no-console -- logging engine is not initialized yet
  console.error('[VidTSX] Another instance already holds the single-instance lock (an installed copy of the app also counts) — exiting.');
  app.quit();
  process.exit(0);
}

// Windows taskbar grouping + toast notification identity
if (process.platform === 'win32') {
  app.setAppUserModelId('com.learnwithhasan.vidtsx-studio');
}

Menu.setApplicationMenu(null);

// Opt-in crash reporting (Settings > Privacy). Sentry's native crash handler
// must install before app 'ready'; no-ops without a build-time DSN + user consent.
initCrashReporting();

let mainWindow: BrowserWindow | null = null;

/** Park a double-clicked .vidtsx and tell the window to go to Studio. The path
 *  waits in main until the project browser claims it, so a cold start into
 *  another screen cannot drop it. */
function queuePackageOpen(filePath: string): void {
  setPendingPackage(filePath);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.STUDIO_PACKAGE_OPEN_FILE, { filePath });
  }
}

app.on('second-instance', (_event, argv) => {
  const packagePath = packagePathFromArgv(argv);
  if (packagePath) queuePackageOpen(packagePath);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS hands file-association opens here rather than on argv.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  queuePackageOpen(filePath);
});

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';

  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, iconFile)
    : path.join(__dirname, '../../resources', iconFile);

  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a1e',
    icon: iconPath,
    ...(isMac && {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 10 },
    }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: app.isPackaged, // Enabled in production; disabled in dev for localhost module server
      webviewTag: true, // Required for YouTube Thumbnail Tester live preview
    },
  });

  win.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i' && !app.isPackaged) {
      win.webContents.toggleDevTools();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    // A cold-start double-click: the browser also claims on mount, so this is
    // purely the nudge that gets the user to the Studio screen.
    if (hasPendingPackage()) {
      win.webContents.send(IPC.STUDIO_PACKAGE_OPEN_FILE, {});
    }
  });

  // Q10 quit-flush: defer the first close while the Studio editor flushes its
  // debounced autosave (the renderer acks instantly when nothing is dirty).
  installQuitFlushGuard(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// A .vidtsx passed on the command line (Windows/Linux file association).
const launchPackagePath = packagePathFromArgv(process.argv);
if (launchPackagePath) setPendingPackage(launchPackagePath);

app.whenReady().then(async () => {
  const startupBegan = Date.now();

  // Initialize log engine (file logging) — everything else can log
  await initLogging();

  // Ensure projects directory exists
  await ensureProjectsDir();

  // Migrate the Image Studio JSON manifest into SQLite + reconcile orphan image
  // files on disk that never made it into the manifest (see image-studio-migrate.ts).
  await migrateImageStudio();

  // Initialize Video Studio DB + reconcile orphan video files on disk.
  await migrateVideoStudio();

  // Migrate legacy per-project JSON files under transcription-projects/ into SQLite.
  await migrateTranscriptionProjects();

  // Migrate legacy render-queue.json + render-history.json into SQLite.
  await migrateRenderQueue();

  // Initialize flows projects DB (node-graph builder).
  await migrateFlowsProjects();

  // Settings must migrate before any engine init — llm/image/audio/sdimage/localllm
  // engines all read provider configs + active model selections from settings.
  await migrateSettings();

  // BYOK migration: seed shared provider credentials from legacy per-engine
  // configs and drop removed VidTSX provider rows. Must run before engine init.
  await migrateProviderSettings();

  // Encrypt plaintext provider keys at rest (safeStorage / Q4). After the
  // migrations above so it re-encrypts their final shape; before engine init
  // is irrelevant — reads handle both forms transparently.
  migrateSensitiveSettings();

  // Initialize LLM engine with saved provider configs
  await initLLMEngine();

  // Initialize image generation engine with saved provider configs
  await initImageEngine();

  // Initialize transcription engine (local whisper / AssemblyAI / OpenRouter)
  await initSttEngine();

  // Local AI engines (sherpa-onnx audio, sd-cli image/video, node-llama-cpp)
  // are NOT initialized here — no native addons, GPU probes, or model-folder
  // scans at startup (V1_RELEASE_PLAN.md Phase B). Each engine lazy-inits via
  // its ensure* function on the first IPC call that needs it. Only the
  // model-library categories register now so on-demand scans work.
  await initSdImageCategory();
  await initSdVideoCategory();
  // AI runtime (downloadable Python + PyTorch): registry entry + staging cleanup, no Python spawned.
  await initAiRuntime();
  registerThreedCategory();

  // Migrate legacy downloads.json into SQLite before the download engine reads state.
  await migrateDownloads();

  // Initialize download manager engine
  initDownloadEngine({ maxConcurrent: 3 });
  await restoreDownloads();

  // Migrate legacy ai-usage-log.json into SQLite before the service opens the DB.
  await migrateAiUsage();

  // Initialize AI usage tracking service
  const { aiUsageService } = await import('./services/ai-usage');
  await aiUsageService.init();

  registerAllIPC();

  // Re-queue TSX generation jobs that were still queued at last quit — held,
  // not running, so no LLM work (or claude.exe spawn) happens without the user.
  // After registerAllIPC so the job-event broadcast listener is attached.
  const { tsxJobEngine } = await import('./services/tsx-jobs/tsx-job-engine');
  const { getTsxJobsMaxConcurrent } = await import('./services/settings');
  tsxJobEngine.configure({ maxConcurrent: await getTsxJobsMaxConcurrent() });
  await tsxJobEngine.restore();

  const win = createWindow();
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  app.setAboutPanelOptions({
    applicationName: 'VidTSX Studio',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright (C) 2026 LearnWithHasan',
    iconPath: path.join(process.resourcesPath, 'icon.ico'),
  });

  // Start system resource monitor (always-on, sends push events every 2s)
  initSystemMonitor(win);

  // Auto-update: first check is delayed 30s so it never competes with startup.
  initUpdater(win);

  logEngine.info('Startup', `Main-process init complete in ${Date.now() - startupBegan}ms (ready → window created)`);
});

// Electron does NOT await async 'will-quit' listeners, so the teardown below used
// to race the process exit — harmless most of the time, but fatal when an
// auto-update installer starts copying files over a half-merged SQLite WAL.
// Defer the quit once, await the shared teardown, then exit for real.
// gracefulShutdown() is idempotent and self-limiting (10s cap), so a hung
// subsystem delays the quit briefly instead of wedging it.
let quitHandled = false;
app.on('will-quit', (event) => {
  if (quitHandled) return;
  quitHandled = true;
  event.preventDefault();
  // Re-quit rather than app.exit(): the second pass falls through this guard and
  // lets Electron run its normal quit sequence, which is what emits 'quit' — the
  // event electron-updater's autoInstallOnAppQuit hook listens for. app.exit()
  // would skip it and silently break install-on-next-quit.
  void gracefulShutdown().finally(() => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
