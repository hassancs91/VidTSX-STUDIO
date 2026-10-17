import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type {
  TsxJobIpc,
  TsxJobStatus,
  TsxJobStartRequest,
} from '@shared/ipc/types';
import { runBuildJob, validateBuildRequest, type TsxJobOwner } from './tsx-build-job';
import { initialBuildSnapshot } from './build-job-snapshot';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('TsxJobs');

const ACTIVE_STATUSES: TsxJobStatus[] = ['planning', 'generating', 'verifying', 'fixing', 'naming', 'saving'];

interface JobRecord {
  snapshot: TsxJobIpc;
  request: TsxJobStartRequest;
  /** A build started from main by another caller; absent = the Creator. */
  owner?: TsxJobOwner;
  abort: AbortController;
}

interface PersistedJob {
  request: TsxJobStartRequest;
  createdAt: number;
}

function isActive(status: TsxJobStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function isFinished(status: TsxJobStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}

/**
 * TSX build jobs, modeled on the download manager: id-keyed records, a
 * maxConcurrent throttle with overflow queueing, per-job abort, and
 * queued-job persistence across restarts. Every job is kind `build`, the TSX
 * builder (tsx-build-job.ts): builds run one at a time app-wide (each one
 * bundles and renders stills while it works). The one-shot pipeline's kinds
 * (generate / edit / fix) were deleted in P3 part 8; a queued one restored
 * from an older app is dropped with a log line.
 */
class TsxJobEngine {
  private jobs = new Map<string, JobRecord>();
  private listeners = new Set<(job: TsxJobIpc) => void>();
  private streamListeners = new Set<(jobId: string, chunk: string) => void>();
  private maxConcurrent = 4;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private shuttingDown = false;
  // Jobs restored from the last quit stay queued-but-held: restarting the app
  // must not silently spawn LLM work (V1_RELEASE_PLAN.md Phase B). The next
  // user-initiated start() releases the hold.
  private queueHeld = false;
  private restoring = false;

  configure(options: { maxConcurrent?: number }): void {
    if (options.maxConcurrent && options.maxConcurrent >= 1 && options.maxConcurrent <= 4) {
      this.maxConcurrent = options.maxConcurrent;
      this.pump();
    }
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  onEvent(listener: (job: TsxJobIpc) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Live LLM text chunks (throttled) for jobs in the generating step. */
  onStream(listener: (jobId: string, chunk: string) => void): () => void {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }

  list(): TsxJobIpc[] {
    return [...this.jobs.values()].map((r) => ({ ...r.snapshot }));
  }

  /**
   * `owner`: a build started from main by another caller (agents, Studio,
   * flows; P3). It shares the queue — builds run one at a time app-wide — but
   * it runs while restored Creator jobs are held, does not release them, and
   * is not persisted: the caller waiting for it is gone after a restart.
   */
  start(request: TsxJobStartRequest, owner?: TsxJobOwner): { jobId?: string; error?: string } {
    if (this.shuttingDown) return { error: 'App is shutting down' };
    // The IPC hands over whatever the renderer sent: the pipeline's kinds are gone.
    if ((request as { kind: string }).kind !== 'build') return { error: 'Only build jobs exist: the one-shot pipeline was removed.' };
    if (!this.restoring && this.queueHeld && !owner) {
      this.queueHeld = false; // user engaged the generator — release held jobs
    }
    if (!request.prompt?.trim()) return { error: 'Prompt is required' };
    const invalid = validateBuildRequest(request);
    if (invalid) return { error: invalid };

    const id = `tsxjob_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const targetFolderPath = request.build?.editOf?.folderPath ?? owner?.into;
    const record: JobRecord = {
      request,
      ...(owner ? { owner } : {}),
      abort: new AbortController(),
      snapshot: {
        id,
        kind: request.kind,
        ...(owner ? { origin: owner.origin } : {}),
        prompt: request.prompt,
        ...(request.providerId ? { providerId: request.providerId } : {}),
        status: 'queued',
        progress: { step: 'queued', label: 'Queued', percent: 0 },
        ...(targetFolderPath ? { targetFolderPath } : {}),
        ...(request.build ? { build: initialBuildSnapshot(request.build) } : {}),
        createdAt: Date.now(),
      },
    };
    this.jobs.set(id, record);
    this.emit(record);
    this.schedulePersist();
    this.pump();
    return { jobId: id };
  }

  cancel(jobId: string): { success: boolean; error?: string } {
    const record = this.jobs.get(jobId);
    if (!record) return { success: false, error: 'Job not found' };
    if (isFinished(record.snapshot.status)) return { success: true };

    if (record.snapshot.status === 'queued') {
      record.snapshot.status = 'cancelled';
      record.snapshot.completedAt = Date.now();
      this.emit(record);
      this.schedulePersist();
      return { success: true };
    }

    // Running: the abort signal propagates into the in-flight LLM request /
    // session; runJob's catch marks the job cancelled.
    record.abort.abort();
    return { success: true };
  }

  clearCompleted(): number {
    let removed = 0;
    for (const [id, record] of this.jobs) {
      if (isFinished(record.snapshot.status)) {
        this.jobs.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Re-queue jobs that were still queued when the app last quit — held, not
   * running: they show as Queued but nothing spawns until the user starts a
   * new job (which releases the hold and drains them).
   */
  async restore(): Promise<void> {
    try {
      const raw = await fs.readFile(this.persistPath(), 'utf-8');
      const persisted = JSON.parse(raw) as PersistedJob[];
      if (!Array.isArray(persisted)) return;
      // A queued generate / edit / fix from before P3 part 8 has nothing to run on.
      const builds = persisted.filter((item) => item?.request?.prompt && (item.request as { kind: string }).kind === 'build');
      const dropped = persisted.length - builds.length;
      if (dropped > 0) {
        log.info('Dropped queued TSX jobs of a removed kind (the one-shot pipeline)', { count: dropped });
        this.schedulePersist();
      }
      if (builds.length > 0) {
        log.info('Restoring queued TSX jobs (held until user engages)', { count: builds.length });
        this.queueHeld = true;
        this.restoring = true;
        try {
          for (const item of builds) this.start(item.request);
        } finally {
          this.restoring = false;
        }
      }
    } catch {
      // No persisted state — fine
    }
  }

  /** Abort running jobs and flush queued-job state. Called from will-quit. */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const record of this.jobs.values()) {
      if (isActive(record.snapshot.status)) {
        record.abort.abort();
      }
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.persistQueued();
  }

  private persistPath(): string {
    return path.join(app.getPath('userData'), 'tsx-jobs.json');
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistQueued();
    }, 500);
  }

  private async persistQueued(): Promise<void> {
    const queued: PersistedJob[] = [...this.jobs.values()]
      .filter((r) => r.snapshot.status === 'queued' && !r.owner)
      .map((r) => ({ request: r.request, createdAt: r.snapshot.createdAt }));
    try {
      await fs.writeFile(this.persistPath(), JSON.stringify(queued), 'utf-8');
    } catch (err) {
      log.warn('Failed to persist queued jobs', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private emit(record: JobRecord): void {
    const snapshot = { ...record.snapshot };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break the engine
      }
    }
  }

  private runningCount(): number {
    let count = 0;
    for (const record of this.jobs.values()) {
      if (isActive(record.snapshot.status)) count++;
    }
    return count;
  }

  /**
   * Builds run one at a time: a queued one waits for the running one. While
   * restored jobs are held, only another caller's builds run.
   */
  private canStart(record: JobRecord): boolean {
    if (this.queueHeld && !record.owner) return false;
    return this.runningCount() === 0;
  }

  private pump(): void {
    if (this.shuttingDown) return;
    while (this.runningCount() < this.maxConcurrent) {
      const next = [...this.jobs.values()].find((r) => r.snapshot.status === 'queued' && this.canStart(r));
      if (!next) return;
      void this.runJob(next);
    }
  }

  private streamChunk(jobId: string, chunk: string): void {
    for (const listener of this.streamListeners) {
      try { listener(jobId, chunk); } catch { /* ignore */ }
    }
  }

  /** A run that threw: cancelled when its signal fired, else an error with the message. */
  private markFailed(record: JobRecord, err: unknown): void {
    const snap = record.snapshot;
    snap.completedAt = Date.now();
    if (record.abort.signal.aborted) {
      snap.status = 'cancelled';
      snap.progress = { step: 'cancelled', label: 'Cancelled', percent: snap.progress.percent };
      log.info('Job cancelled', { id: snap.id });
    } else {
      snap.status = 'error';
      snap.error = err instanceof Error ? err.message : 'Generation failed';
      snap.progress = { step: 'error', label: 'Failed', percent: snap.progress.percent };
      log.error('Job failed', err, { id: snap.id, kind: snap.kind });
    }
    this.emit(record);
  }

  private async runJob(record: JobRecord): Promise<void> {
    const snap = record.snapshot;
    snap.startedAt = Date.now();
    snap.status = 'generating';
    snap.progress = { step: 'start', label: 'Starting...', percent: 0 };
    this.emit(record);
    this.schedulePersist();

    try {
      await runBuildJob({
        ...record,
        emit: () => this.emit(record),
        stream: (chunk) => this.streamChunk(record.snapshot.id, chunk),
      });
    } catch (err) {
      this.markFailed(record, err);
    } finally {
      this.schedulePersist();
      this.pump();
    }
  }
}

export const tsxJobEngine = new TsxJobEngine();
