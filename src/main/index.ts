import { app, BrowserWindow, Menu, net, protocol } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadDevEnv } from './utils/load-dev-env';
import { registerAllIPC } from './ipc/register';
import { ensureProjectsDir } from './utils/paths';

// Must run before any service that reads unprefixed env vars (e.g. template-pusher
// reads VIDTSX_DRAFT_API_KEY). No-op in packaged builds.
loadDevEnv();
import { initLLMEngine } from './services/llm-init';
import { initImageEngine } from './services/image-init';
import { initAudioEngine } from './services/audio-init';
import { initSttEngine } from './services/stt/stt-init';
import { initSdImageEngine } from './services/sdimage-init';
import { initLocalLlmEngine } from './services/llm-local-init';
import { initSentry, initLogging } from './services/log-init';
import { migrateImageStudio } from './services/image-studio-migrate';
import { closeDb as closeImageStudioDb } from './services/image-studio-db';
import { migrateVideoStudio } from './services/video-studio-migrate';
import { closeDb as closeVideoStudioDb } from './services/video-studio-db';
import { migrateTranscriptionProjects } from './services/transcription-projects-migrate';
import { closeDb as closeTranscriptionDb } from './services/transcription-projects-db';
import { migrateRenderQueue } from './services/render-queue-migrate';
import { closeDb as closeRenderQueueDb } from './services/render-queue-db';
import { closeDb as closeCreatorDb } from './services/creator-db';
import { migrateSettings, migrateProviderSettings } from './services/settings-migrate';
import { closeDb as closeSettingsDb } from './services/settings-db';
import { migrateAiUsage } from './services/ai-usage-migrate';
import { closeDb as closeAiUsageDb } from './services/ai-usage-db';
import { migrateStudioProjects } from './services/studio-projects-migrate';
import { closeDb as closeStudioProjectsDb } from './services/studio-projects-db';
import { closeDb as closeStudioPresetsDb } from './services/studio-presets-db';
import { closeDb as closeStudioBrandsDb } from './services/studio-brands-db';
import { migrateWhiteboardProjects } from './services/whiteboard-projects-migrate';
import { closeDb as closeWhiteboardProjectsDb } from './services/whiteboard-projects-db';
import { migrateWhiteboardSvgs } from './services/whiteboard-svgs-migrate';
import { closeDb as closeWhiteboardSvgsDb } from './services/whiteboard-svgs-db';
import { migrateWhiteboardImages } from './services/whiteboard-images-migrate';
import { closeDb as closeWhiteboardImagesDb, getUserImagePath } from './services/whiteboard-images-db';
import { migrateFlowsProjects } from './services/flows-projects-migrate';
import { closeDb as closeFlowsProjectsDb } from './services/flows-projects-db';
import { migrateDownloads } from './services/download-manager/download-state-migrate';
import { closeDb as closeDownloadsDb } from './services/download-manager/download-state-db';
import { initSystemMonitor, stopSystemMonitor } from './services/system-monitor';
import { initDownloadEngine, restoreDownloads, pauseAllDownloads, flushState } from './services/download-manager';
import { startUpdateScheduler, stopUpdateScheduler } from '../updater/auto-updater';
import { logEngine } from '../logging/log-engine';

// Enable hardware acceleration for better rendering performance
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Single-instance lock — second launches focus the existing window instead of spawning a duplicate
// (matters here because a duplicate spawns a second Python sidecar and fights over the workspace).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

// Windows taskbar grouping + toast notification identity
if (process.platform === 'win32') {
  app.setAppUserModelId('com.learnwithhasan.vidtsx-studio');
}

// Sentry must init before app 'ready' event
initSentry();

// Register custom image protocol schemes as privileged before app 'ready'.
// Handlers themselves are wired inside app.whenReady() below.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vidtsx-image',
    privileges: { secure: true, supportFetchAPI: true, bypassCSP: true },
  },
  {
    scheme: 'vidtsx-font',
    privileges: { secure: true, supportFetchAPI: true, bypassCSP: true },
  },
]);

Menu.setApplicationMenu(null);

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
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
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
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

  // Migrate legacy per-project JSON files under studio-projects/ into SQLite.
  await migrateStudioProjects();

  // Initialize whiteboard projects DB (no legacy data; stub for parity).
  await migrateWhiteboardProjects();

  // Initialize whiteboard user SVG library DB (no legacy data; stub for parity).
  await migrateWhiteboardSvgs();

  // Initialize whiteboard user image library DB (no legacy data; stub for parity).
  await migrateWhiteboardImages();

  // Custom protocol that resolves vidtsx-image://{id} to the on-disk file.
  // Path-traversal is enforced inside getUserImagePath, which only returns
  // paths that resolve under the controlled images directory.
  protocol.handle('vidtsx-image', async (request) => {
    try {
      const url = new URL(request.url);
      const id = url.hostname || url.pathname.replace(/^\//, '');
      const filePath = getUserImagePath(id);
      if (!filePath) return new Response('Not found', { status: 404 });
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Bad request', { status: 400 });
    }
  });

  // Custom protocol that resolves vidtsx-font://{id} to the bundled handwriting
  // font file (Phase 11.b). Path-traversal is enforced inside getBundledFontPath.
  {
    const { getBundledFontPath } = await import('./services/whiteboard-fonts');
    protocol.handle('vidtsx-font', async (request) => {
      try {
        const url = new URL(request.url);
        const id = url.hostname || url.pathname.replace(/^\//, '');
        const filePath = getBundledFontPath(id);
        if (!filePath) return new Response('Not found', { status: 404 });
        return await net.fetch(pathToFileURL(filePath).toString());
      } catch {
        return new Response('Bad request', { status: 400 });
      }
    });
  }

  // Initialize flows projects DB (node-graph builder).
  await migrateFlowsProjects();

  // Settings must migrate before any engine init — llm/image/audio/sdimage/localllm
  // engines all read provider configs + active model selections from settings.
  await migrateSettings();

  // BYOK migration: seed shared provider credentials from legacy per-engine
  // configs and drop removed VidTSX provider rows. Must run before engine init.
  await migrateProviderSettings();

  // Initialize LLM engine with saved provider configs
  await initLLMEngine();

  // Initialize image generation engine with saved provider configs
  await initImageEngine();

  // Initialize local audio engine (sherpa-onnx STT/TTS)
  await initAudioEngine();

  // Initialize transcription engine (local whisper / AssemblyAI / OpenRouter)
  await initSttEngine();

  // Initialize local SD image engine (sd-cli)
  await initSdImageEngine();

  // Initialize local LLM engine (node-llama-cpp)
  await initLocalLlmEngine();

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
  const win = createWindow();
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  app.setAboutPanelOptions({
    applicationName: 'VidTSX Studio',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright (C) 2026 LearnWithHasan',
    website: 'https://learnwithhasan.com/vidtsx',
    iconPath: path.join(process.resourcesPath, 'icon.ico'),
  });

  // License system is dormant — the app is free (BYOK). setupLicenseIPC stays
  // registered in register.ts so the shell remains functional if revived.

  // Schedule auto-update checks (no-op in dev / when packaged binary unavailable)
  startUpdateScheduler(win);

  // Start system resource monitor (always-on, sends push events every 2s)
  initSystemMonitor(win);
});

app.on('will-quit', async () => {
  stopSystemMonitor();
  stopUpdateScheduler();

  // Flush AI usage log
  const { aiUsageService } = await import('./services/ai-usage');
  await aiUsageService.shutdown();

  // Pause all active downloads and persist state
  pauseAllDownloads();
  await flushState();

  // Clean up any running sd-cli processes
  const { imageLocalEngine } = await import('../local-image-engine');
  imageLocalEngine.dispose();

  // Clean up audio engine (unload STT/TTS models)
  const { audioEngine } = await import('../audio-engine');
  audioEngine.dispose();

  // Clean up local LLM engine (free GPU memory)
  const { llmLocalEngine } = await import('../llm-engine');
  await llmLocalEngine.dispose();

  // Close SQLite DBs cleanly so WAL/SHM sidecars merge back.
  closeImageStudioDb();
  closeVideoStudioDb();
  closeTranscriptionDb();
  closeRenderQueueDb();
  closeCreatorDb();
  closeSettingsDb();
  closeAiUsageDb();
  closeStudioProjectsDb();
  closeStudioPresetsDb();
  closeStudioBrandsDb();
  closeWhiteboardProjectsDb();
  closeWhiteboardSvgsDb();
  closeWhiteboardImagesDb();
  closeFlowsProjectsDb();
  closeDownloadsDb();

  await logEngine.shutdown();
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
