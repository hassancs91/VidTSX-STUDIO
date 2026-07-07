import https from 'https';
import http from 'http';
import { createWriteStream, existsSync, statSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import type { ClientRequest, IncomingMessage } from 'http';
import type {
  DownloadEngineConfig,
  DownloadOptions,
  DownloadProgress,
  DownloadStatus,
  DownloadTask,
  DownloadTaskState,
} from './types';
import { loadDownloadState, saveDownloadState, flushDownloadState } from './download-state';
import { extractArchive } from './download-extract';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('DownloadEngine');

// ─── Configuration ────────────────────────────────────────────────

const DEFAULT_CONFIG: DownloadEngineConfig = {
  maxConcurrent: 2,
  maxRetries: 3,
  retryBaseDelayMs: 2000,
  maxRedirects: 5,
};

let config: DownloadEngineConfig = { ...DEFAULT_CONFIG };

// ─── Task registry ────────────────────────────────────────────────

const tasks = new Map<string, DownloadTask>();
const globalListeners = new Set<(progress: DownloadProgress) => void>();

// ─── Speed tracking ───────────────────────────────────────────────

const SPEED_WINDOW_MS = 3000;
const speedSamples = new Map<string, Array<{ time: number; bytes: number }>>();

const PROGRESS_THROTTLE_MS = 250;
const lastEmitTime = new Map<string, number>();

// ─── Transient error codes ────────────────────────────────────────

const TRANSIENT_ERRORS = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE',
  'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH',
]);

// ─── Public API ───────────────────────────────────────────────────

export function initDownloadEngine(overrides?: Partial<DownloadEngineConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
  log.info('Engine initialized', { maxConcurrent: config.maxConcurrent, maxRetries: config.maxRetries });
}

export async function restoreDownloads(): Promise<void> {
  const savedTasks = await loadDownloadState();

  let pausedCount = 0;
  for (const state of savedTasks) {
    // Interrupted downloads are restored as paused — user must explicitly resume
    if (state.status === 'downloading' || state.status === 'queued' || state.status === 'extracting' || state.status === 'verifying') {
      state.status = 'paused';
      pausedCount++;
    }

    tasks.set(state.options.id, {
      state,
      request: null,
      progressCallbacks: new Set(),
      deferred: null,
      retryTimer: null,
    });
  }

  if (savedTasks.length > 0) {
    log.info('Restored download state', { total: savedTasks.length, paused: pausedCount });
  }
}

export function enqueueDownload(
  options: DownloadOptions,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  const existing = tasks.get(options.id);
  if (existing && !isTerminal(existing.state.status)) {
    // If paused, resume instead of rejecting
    if (existing.state.status === 'paused') {
      log.info('Resuming paused download via enqueue', { id: options.id });
      if (onProgress) existing.progressCallbacks.add(onProgress);
      const promise = new Promise<void>((resolve, reject) => {
        existing.deferred = { resolve, reject };
      });
      resumeDownload(options.id);
      return promise;
    }
    log.warn('Rejected duplicate download', { id: options.id, currentStatus: existing.state.status });
    return Promise.reject(new Error(`Download "${options.id}" is already active`));
  }

  log.info('Enqueuing download', { id: options.id, url: options.url });

  const state: DownloadTaskState = {
    options: { ...options, priority: options.priority ?? 0 },
    status: 'queued',
    downloadedBytes: 0,
    totalBytes: 0,
    updatedAt: new Date().toISOString(),
    retryCount: 0,
  };

  const task: DownloadTask = {
    state,
    request: null,
    progressCallbacks: new Set(),
    deferred: null,
    retryTimer: null,
  };

  if (onProgress) {
    task.progressCallbacks.add(onProgress);
  }

  tasks.set(options.id, task);
  persistState();

  const promise = new Promise<void>((resolve, reject) => {
    task.deferred = { resolve, reject };
  });

  processQueue();
  return promise;
}

export function pauseDownload(id: string): void {
  const task = tasks.get(id);
  if (!task || task.state.status !== 'downloading') return;

  log.info('Pausing download', { id });

  if (task.request) {
    task.request.destroy();
    task.request = null;
  }

  setStatus(task, 'paused');
}

export function resumeDownload(id: string): void {
  const task = tasks.get(id);
  if (!task || task.state.status !== 'paused') return;

  log.info('Resuming download', { id, downloadedBytes: task.state.downloadedBytes });

  setStatus(task, 'queued');
  processQueue();
}

export function cancelDownload(id: string): void {
  const task = tasks.get(id);
  if (!task) return;

  log.info('Cancelling download', { id });

  if (task.retryTimer) {
    clearTimeout(task.retryTimer);
    task.retryTimer = null;
  }

  if (task.request) {
    task.request.destroy();
    task.request = null;
  }

  setStatus(task, 'cancelled');
  task.deferred?.reject(new Error('Download cancelled'));
  task.deferred = null;

  // Clean up partial file
  const destPath = task.state.options.destPath;
  fs.unlink(destPath).catch(() => {});
}

export function getDownloadProgress(id: string): DownloadProgress | null {
  const task = tasks.get(id);
  if (!task) return null;
  return buildProgress(task);
}

export function getAllDownloads(): DownloadProgress[] {
  return Array.from(tasks.values()).map(buildProgress);
}

export function onDownloadProgress(
  callback: (progress: DownloadProgress) => void,
): () => void {
  globalListeners.add(callback);
  return () => globalListeners.delete(callback);
}

export function pauseAllDownloads(): void {
  for (const task of tasks.values()) {
    if (task.state.status === 'downloading') {
      if (task.request) {
        task.request.destroy();
        task.request = null;
      }
      task.state.status = 'paused';
      task.state.updatedAt = new Date().toISOString();
    }
  }
}

export async function flushState(): Promise<void> {
  const states = Array.from(tasks.values()).map((t) => t.state);
  await flushDownloadState(states);
}

// ─── Internal: queue management ───────────────────────────────────

function processQueue(): void {
  const activeCount = Array.from(tasks.values()).filter(
    (t) => t.state.status === 'downloading',
  ).length;

  if (activeCount >= config.maxConcurrent) return;

  // Find next queued task by priority (lower = higher priority)
  const queued = Array.from(tasks.values())
    .filter((t) => t.state.status === 'queued')
    .sort((a, b) => (a.state.options.priority ?? 0) - (b.state.options.priority ?? 0));

  const slotsAvailable = config.maxConcurrent - activeCount;
  for (let i = 0; i < slotsAvailable && i < queued.length; i++) {
    startDownload(queued[i]);
  }
}

// ─── Internal: download execution ─────────────────────────────────

function startDownload(task: DownloadTask): void {
  const { id, url, destPath } = task.state.options;
  log.info('Starting download', { id, url, destPath });
  setStatus(task, 'downloading');

  // Check if we have a partial file to resume from
  let existingBytes = 0;
  if (existsSync(destPath)) {
    existingBytes = statSync(destPath).size;
  }

  // Ensure destination directory exists
  const dir = path.dirname(destPath);
  fs.mkdir(dir, { recursive: true }).then(() => {
    makeRequest(task, task.state.options.url, existingBytes, 0);
  }).catch((err) => {
    handleDownloadError(task, err as Error);
  });
}

function makeRequest(
  task: DownloadTask,
  url: string,
  existingBytes: number,
  redirectCount: number,
): void {
  if (redirectCount > config.maxRedirects) {
    handleDownloadError(task, new Error('Too many redirects'));
    return;
  }

  const client = url.startsWith('https') ? https : http;
  const headers: Record<string, string> = {};

  if (existingBytes > 0) {
    headers['Range'] = `bytes=${existingBytes}-`;
  }

  const req: ClientRequest = client.get(url, { headers }, (response: IncomingMessage) => {
    const statusCode = response.statusCode ?? 0;

    // Handle redirects
    if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
      const location = response.headers.location;
      if (!location) {
        handleDownloadError(task, new Error('Redirect without location header'));
        return;
      }
      const redirectUrl = location.startsWith('http')
        ? location
        : new URL(location, url).toString();
      response.resume(); // Drain the response
      makeRequest(task, redirectUrl, existingBytes, redirectCount + 1);
      return;
    }

    // Handle Range response
    let writeFlags: string;
    if (statusCode === 206) {
      // Server supports Range — continue from where we left off
      task.state.downloadedBytes = existingBytes;
      writeFlags = 'a';

      // Parse total from Content-Range: bytes 1000-9999/10000
      const contentRange = response.headers['content-range'];
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          task.state.totalBytes = parseInt(match[1], 10);
        }
      }
      log.debug('Resuming with Range', {
        id: task.state.options.id,
        existingBytes,
        totalBytes: task.state.totalBytes,
        contentRange: response.headers['content-range'],
      });
    } else if (statusCode === 200) {
      // Server does not support Range — start from scratch
      task.state.downloadedBytes = 0;
      writeFlags = 'w';
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      // Only update totalBytes if we got a valid Content-Length
      if (contentLength > 0) {
        task.state.totalBytes = contentLength;
      }
      log.debug('Starting fresh (no Range support)', {
        id: task.state.options.id,
        totalBytes: task.state.totalBytes,
        hadExistingBytes: existingBytes > 0,
      });
    } else if (statusCode && statusCode >= 500) {
      response.resume();
      handleDownloadError(task, new Error(`HTTP ${statusCode}`));
      return;
    } else if (statusCode !== 200 && statusCode !== 206) {
      response.resume();
      handleDownloadError(task, new Error(`HTTP error: ${statusCode}`));
      return;
    } else {
      writeFlags = 'w';
    }

    // Initialize speed tracking
    speedSamples.set(task.state.options.id, []);

    const fileStream = createWriteStream(task.state.options.destPath, { flags: writeFlags });

    response.on('data', (chunk: Buffer) => {
      task.state.downloadedBytes += chunk.length;
      recordSpeed(task.state.options.id, chunk.length);
      emitProgress(task);
    });

    response.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      task.request = null;
      // Only proceed if still downloading — pause/cancel destroy the request
      // which triggers finish, but the status is already changed
      if (task.state.status === 'downloading') {
        onDownloadComplete(task);
      }
    });

    fileStream.on('error', (err) => {
      task.request = null;
      if (task.state.status === 'downloading') {
        handleDownloadError(task, err);
      }
    });

    response.on('error', (err) => {
      fileStream.close();
      task.request = null;
      if (task.state.status === 'downloading') {
        handleDownloadError(task, err);
      }
    });
  });

  req.on('error', (err) => {
    task.request = null;
    if (task.state.status === 'downloading') {
      handleDownloadError(task, err);
    }
  });

  task.request = req;
}

// ─── Internal: post-download pipeline ─────────────────────────────

async function onDownloadComplete(task: DownloadTask): Promise<void> {
  const { id } = task.state.options;

  try {
    // Hash verification
    if (task.state.options.sha256) {
      log.info('Verifying hash', { id });
      setStatus(task, 'verifying');
      const valid = await verifyHash(task.state.options.destPath, task.state.options.sha256);
      if (!valid) {
        log.error('Hash verification failed', new Error('Hash mismatch'), { id });
        await fs.unlink(task.state.options.destPath).catch(() => {});
        setStatus(task, 'failed', 'Hash verification failed');
        task.deferred?.reject(new Error('Hash verification failed'));
        task.deferred = null;
        processQueue();
        return;
      }
      log.info('Hash verified', { id });
    }

    // Extraction
    const extraction = task.state.options.extraction;
    if (extraction && extraction.format !== 'none') {
      log.info('Extracting archive', { id, format: extraction.format, destDir: extraction.destDir });
      setStatus(task, 'extracting');
      await extractArchive(task.state.options.destPath, extraction.destDir, extraction.format);
      if (extraction.deleteArchive !== false) {
        await fs.unlink(task.state.options.destPath).catch(() => {});
      }
      log.info('Extraction complete', { id });
    }

    log.info('Download completed', {
      id,
      downloadedBytes: task.state.downloadedBytes,
      totalBytes: task.state.totalBytes,
    });
    setStatus(task, 'completed');
    task.deferred?.resolve();
    task.deferred = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Post-download step failed';
    log.error('Post-download step failed', err, { id });
    setStatus(task, 'failed', message);
    task.deferred?.reject(err instanceof Error ? err : new Error(message));
    task.deferred = null;
  }

  processQueue();
}

async function verifyHash(filePath: string, expectedSha256: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex') === expectedSha256));
    stream.on('error', reject);
  });
}

// ─── Internal: error handling & retry ─────────────────────────────

function handleDownloadError(task: DownloadTask, err: Error): void {
  const { id } = task.state.options;
  const code = (err as NodeJS.ErrnoException).code;
  const isTransient = (code && TRANSIENT_ERRORS.has(code)) || err.message.startsWith('HTTP 5');

  if (isTransient && task.state.retryCount < config.maxRetries) {
    task.state.retryCount++;
    const delay = Math.min(
      config.retryBaseDelayMs * Math.pow(2, task.state.retryCount - 1),
      30000,
    );
    log.warn('Transient error, scheduling retry', {
      id, error: err.message, attempt: task.state.retryCount, delayMs: delay,
    });
    task.state.lastError = err.message;
    task.state.status = 'queued';
    task.state.updatedAt = new Date().toISOString();
    persistState();

    task.retryTimer = setTimeout(() => {
      task.retryTimer = null;
      processQueue();
    }, delay);
    return;
  }

  log.error('Download failed', err, { id, retries: task.state.retryCount });
  setStatus(task, 'failed', err.message);
  task.deferred?.reject(err);
  task.deferred = null;
  processQueue();
}

// ─── Internal: progress & state helpers ───────────────────────────

function setStatus(task: DownloadTask, status: DownloadStatus, error?: string): void {
  task.state.status = status;
  task.state.updatedAt = new Date().toISOString();
  if (error) {
    task.state.lastError = error;
  }
  persistState();
  emitProgress(task, true);
}

function buildProgress(task: DownloadTask): DownloadProgress {
  const { state } = task;
  const speed = calculateSpeed(state.options.id);
  const percent = state.totalBytes > 0
    ? Math.round((state.downloadedBytes / state.totalBytes) * 100)
    : -1;
  const etaSeconds = speed > 0 && state.totalBytes > 0
    ? Math.round((state.totalBytes - state.downloadedBytes) / speed)
    : -1;

  return {
    id: state.options.id,
    status: state.status,
    downloadedBytes: state.downloadedBytes,
    totalBytes: state.totalBytes,
    percent,
    speedBps: Math.round(speed),
    etaSeconds,
    error: state.lastError,
    metadata: state.options.metadata,
  };
}

function emitProgress(task: DownloadTask, force = false): void {
  const now = Date.now();
  const lastTime = lastEmitTime.get(task.state.options.id) ?? 0;

  if (!force && now - lastTime < PROGRESS_THROTTLE_MS) return;
  lastEmitTime.set(task.state.options.id, now);

  const progress = buildProgress(task);

  for (const cb of task.progressCallbacks) {
    cb(progress);
  }
  for (const cb of globalListeners) {
    cb(progress);
  }
}

function recordSpeed(id: string, bytes: number): void {
  const now = Date.now();
  const samples = speedSamples.get(id);
  if (!samples) return;

  samples.push({ time: now, bytes });

  // Remove samples outside the window
  const cutoff = now - SPEED_WINDOW_MS;
  while (samples.length > 0 && samples[0].time < cutoff) {
    samples.shift();
  }
}

function calculateSpeed(id: string): number {
  const samples = speedSamples.get(id);
  if (!samples || samples.length < 2) return 0;

  const totalBytes = samples.reduce((sum, s) => sum + s.bytes, 0);
  const elapsed = (samples[samples.length - 1].time - samples[0].time) / 1000;

  return elapsed > 0 ? totalBytes / elapsed : 0;
}

function isTerminal(status: DownloadStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function persistState(): void {
  const states = Array.from(tasks.values()).map((t) => t.state);
  saveDownloadState(states);
}
