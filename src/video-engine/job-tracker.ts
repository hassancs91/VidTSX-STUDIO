import { randomUUID } from 'crypto';
import { ModerationBlockedError } from '../shared/content-safety';
import { logEngine } from '../logging/log-engine';
import type {
  VideoJobListener,
  VideoJobRecord,
  VideoJobResult,
  VideoJobStatus,
  VideoProvider,
} from './types';

const log = logEngine.createLogger('VideoJobs');

export interface VideoJobTrackerOptions {
  /** Provider poll cadence. */
  pollIntervalMs: number;
  /** Give up on a job still pending/running after this long. */
  maxWaitMs: number;
  /** Keep finished records readable this long (the UI polls once after completion). */
  retainMs: number;
}

/** Finishing step run once the provider reports a clip: download → gate → file. */
export type VideoJobFinisher = (
  record: VideoJobRecord,
  completed: { url: string; contentType?: string },
) => Promise<VideoJobResult>;

const TERMINAL: ReadonlySet<VideoJobStatus> = new Set(['completed', 'failed', 'cancelled']);

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

/**
 * In-memory job map (D5) with one poll loop per job. Every state change goes
 * through `update`, which stamps `updatedAt` and notifies subscribers — the
 * `video:job-progress` push is one such subscriber, so screens subscribe
 * instead of polling the provider per job.
 */
export class VideoJobTracker {
  private readonly jobs = new Map<string, VideoJobRecord>();
  private readonly providers = new Map<string, VideoProvider>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners = new Set<VideoJobListener>();

  constructor(
    private readonly options: VideoJobTrackerOptions,
    private readonly finish: VideoJobFinisher,
  ) {}

  newJobId(): string {
    return randomUUID();
  }

  /** Record a submitted job and start polling it. */
  start(provider: VideoProvider, record: VideoJobRecord): VideoJobRecord {
    this.prune();
    const controller = new AbortController();
    this.jobs.set(record.jobId, { ...record });
    this.providers.set(record.jobId, provider);
    this.controllers.set(record.jobId, controller);
    this.notify(record.jobId);
    void this.run(provider, record.jobId, controller.signal);
    return { ...record };
  }

  get(jobId: string): VideoJobRecord | undefined {
    const record = this.jobs.get(jobId);
    return record ? { ...record } : undefined;
  }

  list(): VideoJobRecord[] {
    return Array.from(this.jobs.values(), (r) => ({ ...r }));
  }

  subscribe(listener: VideoJobListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stop polling, mark the record cancelled, and tell the provider (best effort). */
  async cancel(jobId: string): Promise<void> {
    const record = this.jobs.get(jobId);
    if (!record) throw new Error(`Unknown video job "${jobId}" (jobs do not survive app restarts).`);
    if (TERMINAL.has(record.status)) return;
    this.controllers.get(jobId)?.abort();
    this.update(jobId, { status: 'cancelled', error: 'Cancelled' });
    const provider = this.providers.get(jobId);
    if (provider?.cancel) {
      try {
        await provider.cancel(record.providerJobId);
      } catch (err) {
        log.warn('Provider cancel failed (job already marked cancelled)', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.release(jobId);
  }

  private async run(provider: VideoProvider, jobId: string, signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    const providerJobId = this.jobs.get(jobId)?.providerJobId ?? '';
    try {
      while (!signal.aborted) {
        await sleep(this.options.pollIntervalMs, signal);
        if (signal.aborted) return;
        if (Date.now() - startedAt > this.options.maxWaitMs) {
          this.update(jobId, { status: 'failed', error: 'Video generation timed out.' });
          return;
        }

        const poll = await provider.poll(providerJobId, signal);
        if (signal.aborted) return;

        if (poll.status === 'failed') {
          this.update(jobId, { status: 'failed', error: poll.error });
          return;
        }
        // Completed at the provider — the clip is not done until it is gated
        // and filed locally; the record reads `running` until then.
        const status = poll.status === 'completed' ? 'running' : poll.status;
        if (this.jobs.get(jobId)?.status !== status) this.update(jobId, { status });
        if (poll.status !== 'completed') continue;

        const record = this.jobs.get(jobId)!;
        const result = await this.finish(record, poll);
        if (signal.aborted) return;
        this.update(jobId, { status: 'completed', result });
        return;
      }
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      log.warn('Video job failed', { jobId, error: message });
      this.update(jobId, {
        status: 'failed',
        error: message,
        ...(err instanceof ModerationBlockedError ? { blocked: err.toBlockInfo() } : {}),
      });
    } finally {
      this.release(jobId);
    }
  }

  private update(jobId: string, patch: Partial<VideoJobRecord>): void {
    const current = this.jobs.get(jobId);
    if (!current) return;
    this.jobs.set(jobId, { ...current, ...patch, updatedAt: Date.now() });
    this.notify(jobId);
  }

  private notify(jobId: string): void {
    const record = this.get(jobId);
    if (!record) return;
    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch (err) {
        log.warn('Job listener threw', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /** Drop the poll-loop handles once a job is terminal; the record stays readable. */
  private release(jobId: string): void {
    this.controllers.delete(jobId);
    this.providers.delete(jobId);
  }

  private prune(): void {
    const cutoff = Date.now() - this.options.retainMs;
    for (const [jobId, record] of this.jobs) {
      if (TERMINAL.has(record.status) && record.updatedAt < cutoff) this.jobs.delete(jobId);
    }
  }
}
