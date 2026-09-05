/**
 * Install / repair / remove the AI runtime (plan §3 step 3). Shape copied from
 * sdcli-install.ts: one inflight promise, one download-engine task (sha256 + zip
 * extraction), then a verify step that is specific to this runtime:
 *
 *   preflight → download+extract into `<name>.tmp` → manifest check → --selftest both
 *   pipelines → --warmup (compiles the stack while the user waits here, not on their
 *   first generation) → atomic rename to `<version>-<variant>` → drop older versions.
 *
 * Progress: the download engine broadcasts DOWNLOAD_PROGRESS (metadata.type =
 * 'ai-runtime'); the phases after the engine hands over are published through
 * `onAiRuntimeStatusChanged` so the System row can show "Verifying…" / "Warming up…".
 */
import fs from 'fs/promises';
import path from 'path';
import { statfs } from 'fs/promises';
import { enqueueDownload, cancelDownload, getAllDownloads } from '../download-manager';
import { getAiRuntimeDir, getAiRuntimeRoot, getPipelinesDir } from '../../utils/paths';
import { logEngine } from '../../../logging/log-engine';
import type { AiRuntimeInstallPhase, AiRuntimeInstallProgress, AiRuntimeVariant } from '@shared/ipc/types/ai-runtime';
import {
  AI_RUNTIME_CATALOGUE,
  AI_RUNTIME_DOWNLOAD_TYPE,
  AI_RUNTIME_VERSION,
  aiRuntimeDirName,
  aiRuntimeDownloadId,
  parseAiRuntimeDirName,
} from './catalogue';
import { aiRuntimePythonPath, readAiRuntimeManifest } from './manifest';
import { checkDisk, checkPathBudget, checkPlatform, chooseVariant, readLongPathsEnabled } from './preflight';
import { runPipelineSelftest } from './selftest';
import { getGpuFacts } from './gpu';

const log = logEngine.createLogger('AiRuntimeInstall');

let inflight: Promise<void> | null = null;
let progress: AiRuntimeInstallProgress | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

export function isAiRuntimeInstalling(): boolean {
  return inflight !== null;
}

export function getAiRuntimeInstallProgress(): AiRuntimeInstallProgress | null {
  return progress;
}

export function getAiRuntimeLastError(): string | null {
  return lastError;
}

/** Fired on every phase change, completion, failure and removal. */
export function onAiRuntimeStatusChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notify(): void {
  for (const cb of listeners) {
    try { cb(); } catch (err) { log.warn('status listener threw', { error: String(err) }); }
  }
}

function setPhase(variant: AiRuntimeVariant, phase: AiRuntimeInstallPhase, message?: string): void {
  progress = { variant, phase, downloadId: aiRuntimeDownloadId(variant), message };
  log.info('phase', { variant, phase, message });
  notify();
}

export interface InstallAiRuntimeOptions {
  /** Omit to install the variant the GPU check recommends. */
  variant?: AiRuntimeVariant;
  /** Re-download even when this version is already installed. */
  repair?: boolean;
}

/**
 * Download + verify + reveal the pinned runtime. Idempotent while running: a second
 * call (any options) joins the install in flight.
 */
export function installAiRuntime(opts: InstallAiRuntimeOptions = {}): Promise<void> {
  inflight ??= doInstall(opts)
    .then(() => { lastError = null; })
    .catch((err: unknown) => {
      lastError = err instanceof Error ? err.message : String(err);
      throw err;
    })
    .finally(() => {
      inflight = null;
      progress = null;
      notify();
    });
  return inflight;
}

async function rmrf(p: string): Promise<void> {
  await fs.rm(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

async function exists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

async function renameWithRetry(from: string, to: string, attempts = 6): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!retryable || i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
}

async function freeBytesAt(dir: string): Promise<number> {
  try {
    const s = await statfs(dir);
    return Number(s.bfree) * Number(s.bsize);
  } catch {
    return Number.MAX_SAFE_INTEGER; // unknown → don't block; the download will surface ENOSPC
  }
}

async function doInstall(opts: InstallAiRuntimeOptions): Promise<void> {
  const platformIssue = checkPlatform();
  if (platformIssue) throw new Error(platformIssue.message);

  const root = getAiRuntimeRoot();
  await fs.mkdir(root, { recursive: true });

  // ---- preflight
  const gpu = await getGpuFacts();
  const variant: AiRuntimeVariant = opts.variant ?? chooseVariant(gpu, AI_RUNTIME_CATALOGUE.cu126.minDriver).variant;
  const entry = AI_RUNTIME_CATALOGUE[variant];
  const name = aiRuntimeDirName(entry.version, variant);
  const finalDir = getAiRuntimeDir(entry.version, variant);
  const stagingDir = `${finalDir}.tmp`;
  const zipPath = path.join(root, `${name}.zip`);
  setPhase(variant, 'preflight');

  const pathIssue = checkPathBudget(finalDir, entry.maxRelativePathLength, await readLongPathsEnabled());
  if (pathIssue) throw new Error(pathIssue.message);

  if (!opts.repair && (await exists(path.join(finalDir, 'manifest.json')))) {
    log.info('Runtime already installed, verifying only', { name });
    await verify(finalDir, variant, entry.torch);
    return;
  }

  const diskIssue = checkDisk(await freeBytesAt(root), entry);
  if (diskIssue) throw new Error(diskIssue.message);

  // ---- download + extract into staging (engine verifies sha256 before extracting)
  if (opts.repair) await rmrf(finalDir);
  await rmrf(stagingDir);
  await fs.mkdir(stagingDir, { recursive: true });
  setPhase(variant, 'downloading');
  log.info('Downloading runtime', { name, url: entry.urls[0], bytes: entry.bytes });
  await enqueueDownload({
    id: aiRuntimeDownloadId(variant),
    url: entry.urls[0],
    mirrors: entry.urls.slice(1),
    destPath: zipPath,
    sha256: entry.sha256,
    extraction: { format: 'zip', destDir: stagingDir, deleteArchive: true },
    metadata: { type: AI_RUNTIME_DOWNLOAD_TYPE, variant, version: entry.version },
  });

  // ---- verify + warm up on the staged folder, then reveal atomically
  try {
    await verify(stagingDir, variant, entry.torch);
    setPhase(variant, 'finalizing');
    await rmrf(finalDir);
    await renameWithRetry(stagingDir, finalDir);
  } catch (err) {
    await rmrf(stagingDir).catch(() => {});
    throw err;
  }

  await removeOtherRuntimes(finalDir);
  log.info('Runtime installed', { name, dir: finalDir });
}

/** manifest → selftest both pipelines → warm-up. Throws a readable error on any mismatch. */
async function verify(dir: string, variant: AiRuntimeVariant, expectedTorch: string): Promise<void> {
  setPhase(variant, 'verifying', 'Checking the downloaded files');
  const manifest = await readAiRuntimeManifest(dir);
  if (manifest.variant !== variant || manifest.version !== AI_RUNTIME_VERSION) {
    throw new Error(`Downloaded runtime is ${manifest.name}, expected ${aiRuntimeDirName(AI_RUNTIME_VERSION, variant)}.`);
  }
  const python = aiRuntimePythonPath(dir, manifest);
  if (!(await exists(python))) throw new Error('python.exe is missing from the extracted runtime.');
  const pipelines = getPipelinesDir();

  setPhase(variant, 'verifying', 'Starting Python for the first time (Windows scans new files; this can take a minute)');
  const triposr = await runPipelineSelftest(python, pipelines, 'triposr');
  if (triposr.ready.torch !== expectedTorch) {
    throw new Error(`Runtime reports torch ${triposr.ready.torch ?? 'none'}, expected ${expectedTorch}.`);
  }
  log.info('triposr selftest ok', { ms: triposr.ms, cuda: triposr.ready.cuda, device: triposr.ready.device });

  setPhase(variant, 'warming-up', 'Preparing the image tools');
  const rembg = await runPipelineSelftest(python, pipelines, 'rembg');
  log.info('rembg selftest ok', { ms: rembg.ms, providers: rembg.ready.providers });

  setPhase(variant, 'warming-up', 'Preparing the 3D pipeline');
  const warm = await runPipelineSelftest(python, pipelines, 'triposr', { mode: 'warmup' });
  log.info('triposr warm-up ok', { ms: warm.ms });
}

/** Drop every other `<version>-<variant>` folder and stale `.tmp` staging dirs. */
async function removeOtherRuntimes(keepDir: string): Promise<void> {
  const root = getAiRuntimeRoot();
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (full === keepDir) continue;
    if (e.isDirectory() && (parseAiRuntimeDirName(e.name) || e.name.endsWith('.tmp'))) {
      log.info('Removing old runtime folder', { dir: full });
      await rmrf(full).catch((err) => log.warn('Could not remove old runtime', { dir: full, error: String(err) }));
    } else if (e.isFile() && e.name.endsWith('.zip')) {
      await fs.unlink(full).catch(() => {});
    }
  }
}

/** Remove staging leftovers from an interrupted install (called at startup). */
export async function cleanupAiRuntimeStaging(): Promise<void> {
  const root = getAiRuntimeRoot();
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (e.isDirectory() && e.name.endsWith('.tmp')) {
      await rmrf(path.join(root, e.name)).catch(() => {});
    }
  }
}

/** Re-download the installed (or recommended) variant from scratch. */
export function repairAiRuntime(variant?: AiRuntimeVariant): Promise<void> {
  return installAiRuntime({ variant, repair: true });
}

/** Delete every installed runtime folder. Cancels an in-flight download first. */
export async function removeAiRuntime(): Promise<void> {
  for (const d of getAllDownloads()) {
    if (d.metadata?.type === AI_RUNTIME_DOWNLOAD_TYPE && !['completed', 'failed', 'cancelled'].includes(d.status)) {
      cancelDownload(d.id);
    }
  }
  if (inflight) {
    await inflight.catch(() => {});
  }
  const root = getAiRuntimeRoot();
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    await rmrf(path.join(root, e.name));
  }
  lastError = null;
  log.info('Runtime removed', { root });
  notify();
}
