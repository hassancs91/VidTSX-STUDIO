/**
 * Serial queue in front of `runPipeline` (image-engine.ts shape): one Python worker at a
 * time for the whole app — one GPU, jobs serialised across Image Studio, 3D Studio, the
 * Studio agent and Flows (plan §7b). Promise-based: `run()` settles when the job completes,
 * fails, or is cancelled; `onProgress` fans stage/progress events to whoever listens.
 */
import { randomUUID } from 'crypto';
import { killActive } from './python-runner';
import { runPipeline } from './python-runner';
import { classifyPythonFailure, PythonRunError } from './python-failure';
import type { PythonJob, PythonJobProgress, PythonProtocolEvent, PythonRunOptions, PythonRunResult } from './types';

export type PythonRunner = (opts: PythonRunOptions) => Promise<PythonRunResult>;

export class PythonLocalEngine {
  private queue: PythonJob[] = [];
  private processing = false;
  private runner: PythonRunner;

  /** Stage / progress for every job (keyed by requestId). */
  onProgress: ((progress: PythonJobProgress) => void) | null = null;

  constructor(runner: PythonRunner = runPipeline) {
    this.runner = runner;
  }

  /** Queue a run. `options.signal` cancels it whether queued or running. Callers may supply the id (to subscribe to progress first). */
  run(options: PythonRunOptions, requestId: string = randomUUID()): { requestId: string; promise: Promise<PythonRunResult> } {
    const promise = new Promise<PythonRunResult>((resolve, reject) => {
      const job: PythonJob = { requestId, options, status: 'queued', settle: { resolve, reject } };
      this.queue.push(job);
      options.signal?.addEventListener('abort', () => this.cancel(requestId), { once: true });
      void this.processNext();
    });
    return { requestId, promise };
  }

  cancel(requestId: string): boolean {
    const job = this.queue.find((j) => j.requestId === requestId);
    if (!job) return false;
    if (job.status === 'queued') {
      job.status = 'cancelled';
      this.queue = this.queue.filter((j) => j !== job);
      job.settle.reject(new PythonRunError(classifyPythonFailure({ cancelled: true, exitCode: null }), ''));
      return true;
    }
    if (job.status === 'running') {
      job.status = 'cancelled';
      killActive();
      return true;
    }
    return false;
  }

  cancelAll(): void {
    for (const job of [...this.queue]) this.cancel(job.requestId);
  }

  /** Queued + running jobs, for status views. */
  pending(): Array<{ requestId: string; status: PythonJob['status'] }> {
    return this.queue.map((j) => ({ requestId: j.requestId, status: j.status }));
  }

  isBusy(): boolean {
    return this.processing;
  }

  private emit(job: PythonJob, evt: PythonProtocolEvent): void {
    let progress: PythonJobProgress | null = null;
    if (evt.type === 'ready') progress = { requestId: job.requestId, stage: 'ready' };
    else if (evt.type === 'stage') progress = { requestId: job.requestId, stage: evt.name };
    else if (evt.type === 'progress') progress = { requestId: job.requestId, stage: evt.stage, pct: evt.pct };
    if (progress) {
      try {
        this.onProgress?.(progress);
      } catch {
        /* listeners never break the queue */
      }
    }
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    const job = this.queue.find((j) => j.status === 'queued');
    if (!job) return;
    this.processing = true;
    job.status = 'running';
    this.onProgress?.({ requestId: job.requestId, stage: 'starting' });

    try {
      const result = await this.runner({
        ...job.options,
        onEvent: (evt) => {
          this.emit(job, evt);
          job.options.onEvent?.(evt);
        },
      });
      if ((job.status as PythonJob['status']) === 'cancelled') {
        job.settle.reject(new PythonRunError(classifyPythonFailure({ cancelled: true, exitCode: null }), result.stderrTail));
      } else {
        job.status = 'completed';
        job.settle.resolve(result);
      }
    } catch (err) {
      const cancelled = (job.status as PythonJob['status']) === 'cancelled';
      if (cancelled) {
        job.settle.reject(new PythonRunError(classifyPythonFailure({ cancelled: true, exitCode: null }), err instanceof PythonRunError ? err.details : ''));
      } else {
        job.status = 'failed';
        job.settle.reject(err instanceof Error ? err : new Error('Python run failed'));
      }
    } finally {
      this.queue = this.queue.filter((j) => j !== job && j.status === 'queued');
      this.processing = false;
      void this.processNext();
    }
  }
}

export const pythonLocalEngine = new PythonLocalEngine();
