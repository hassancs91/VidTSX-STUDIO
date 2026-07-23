import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { generateTsxPipeline, editTsxPipeline, generateProjectName } from '@shared/tsx-engine';
import type { TsxEngineDeps } from '@shared/tsx-engine';
import type { PipelineProgress, TsxPipelineResult } from '@shared/tsx-engine';
import type {
  TsxJobIpc,
  TsxJobStatus,
  TsxJobStartRequest,
} from '@shared/ipc/types';
import { runLlmGenerate } from '../../ipc/llm-handlers';
import { validateTsxCode } from '../../ipc/tsx-handlers';
import { reserveProjectFolder, writeNextVersion, writeDebugSidecar } from './project-store';
import { readChatHistory, appendChatTurns, CHAT_CONTEXT_LIMIT } from './chat-store';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('TsxJobs');

const ACTIVE_STATUSES: TsxJobStatus[] = ['planning', 'generating', 'verifying', 'fixing', 'naming', 'saving'];
const STEP_STATUS: Record<string, TsxJobStatus> = {
  plan: 'planning',
  generate: 'generating',
  verify: 'verifying',
  transpile: 'fixing',
  fix: 'fixing',
};

interface JobRecord {
  snapshot: TsxJobIpc;
  request: TsxJobStartRequest;
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
 * Concurrent TSX generation jobs, modeled on the download manager: id-keyed
 * records, a maxConcurrent throttle with overflow queueing, per-job abort, and
 * queued-job persistence across restarts. Runs the shared tsx-engine pipeline
 * with main-process deps (direct engine + transpiler calls, per-job signal).
 */
class TsxJobEngine {
  private jobs = new Map<string, JobRecord>();
  private listeners = new Set<(job: TsxJobIpc) => void>();
  private streamListeners = new Set<(jobId: string, chunk: string) => void>();
  private maxConcurrent = 4;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private shuttingDown = false;

  configure(options: { maxConcurrent?: number }): void {
    if (options.maxConcurrent && options.maxConcurrent >= 1 && options.maxConcurrent <= 4) {
      this.maxConcurrent = options.maxConcurrent;
      this.pump();
    }
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

  start(request: TsxJobStartRequest): { jobId?: string; error?: string } {
    if (this.shuttingDown) return { error: 'App is shutting down' };
    if (!request.prompt?.trim()) return { error: 'Prompt is required' };
    if ((request.kind === 'edit' || request.kind === 'fix') && !request.target) {
      return { error: `A target project is required for ${request.kind} jobs` };
    }

    const id = `tsxjob_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const record: JobRecord = {
      request,
      abort: new AbortController(),
      snapshot: {
        id,
        kind: request.kind,
        prompt: request.prompt,
        ...(request.providerId ? { providerId: request.providerId } : {}),
        status: 'queued',
        progress: { step: 'queued', label: 'Queued', percent: 0 },
        ...(request.target ? { targetFolderPath: request.target.folderPath } : {}),
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

  /** Re-queue jobs that were still queued when the app last quit. */
  async restore(): Promise<void> {
    try {
      const raw = await fs.readFile(this.persistPath(), 'utf-8');
      const persisted = JSON.parse(raw) as PersistedJob[];
      if (Array.isArray(persisted) && persisted.length > 0) {
        log.info('Restoring queued TSX jobs', { count: persisted.length });
        for (const item of persisted) {
          if (item?.request?.prompt) this.start(item.request);
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
      .filter((r) => r.snapshot.status === 'queued')
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

  private pump(): void {
    if (this.shuttingDown) return;
    while (this.runningCount() < this.maxConcurrent) {
      const next = [...this.jobs.values()].find((r) => r.snapshot.status === 'queued');
      if (!next) return;
      void this.runJob(next);
    }
  }

  private buildDeps(record: JobRecord): TsxEngineDeps {
    const signal = record.abort.signal;

    // Throttle stream deltas: accumulate and flush every 120ms. Only the
    // generating step's text is forwarded — plan/verify/fix chatter would
    // just flash non-code text at the user.
    let buffer = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (!buffer) return;
      const chunk = buffer;
      buffer = '';
      for (const listener of this.streamListeners) {
        try { listener(record.snapshot.id, chunk); } catch { /* ignore */ }
      }
    };
    const onTextDelta = (delta: string) => {
      if (record.snapshot.status !== 'generating') return;
      buffer += delta;
      if (!flushTimer) flushTimer = setTimeout(flush, 120);
    };

    return {
      llmGenerate: (req) => runLlmGenerate({ ...req, featureSource: 'tsx-generation' }, signal, onTextDelta),
      tsxValidate: (req) => validateTsxCode(req.code),
    };
  }

  private throwIfAborted(record: JobRecord): void {
    if (record.abort.signal.aborted) throw new Error('Job cancelled');
  }

  private async runJob(record: JobRecord): Promise<void> {
    const snap = record.snapshot;
    snap.startedAt = Date.now();
    snap.status = record.request.kind === 'generate' ? 'planning' : 'generating';
    snap.progress = { step: 'start', label: 'Starting...', percent: 0 };
    this.emit(record);
    this.schedulePersist();

    const deps = this.buildDeps(record);
    const onProgress = (p: PipelineProgress) => {
      snap.progress = { step: p.step, label: p.stepLabel, percent: p.percent };
      const mapped = STEP_STATUS[p.step];
      if (mapped) snap.status = mapped;
      this.emit(record);
    };

    try {
      let result: TsxPipelineResult;
      let versionPath: string;

      if (record.request.kind === 'generate') {
        result = await generateTsxPipeline({
          prompt: record.request.prompt,
          ...(record.request.providerId ? { providerId: record.request.providerId } : {}),
          ...record.request.options,
          onProgress,
        }, deps);
        this.throwIfAborted(record);

        snap.status = 'naming';
        snap.progress = { step: 'naming', label: 'Naming project...', percent: 96 };
        this.emit(record);
        const name = await generateProjectName(record.request.prompt, record.request.providerId, deps);
        this.throwIfAborted(record);

        snap.status = 'saving';
        snap.progress = { step: 'saving', label: 'Saving...', percent: 98 };
        this.emit(record);
        const reserved = await reserveProjectFolder(name);
        versionPath = await writeNextVersion(reserved.folderPath, result.text);
        snap.projectName = reserved.name;
        snap.folderPath = reserved.folderPath;

        // Seed the project's refinement conversation
        await appendChatTurns(reserved.folderPath, [
          { role: 'user', content: record.request.prompt },
          { role: 'assistant', content: `Generated ${path.basename(versionPath)} (${result.mode} mode).` },
        ]).catch(() => {});
      } else {
        const target = record.request.target!;
        const chatHistory = (await readChatHistory(target.folderPath))
          .slice(-CHAT_CONTEXT_LIMIT)
          .map(({ role, content }) => ({ role, content }));
        result = await editTsxPipeline({
          currentCode: target.currentCode,
          editInstruction: record.request.prompt,
          ...(record.request.providerId ? { providerId: record.request.providerId } : {}),
          ...record.request.options,
          ...(chatHistory.length > 0 ? { chatHistory } : {}),
          onProgress,
        }, deps);
        this.throwIfAborted(record);

        snap.status = 'saving';
        snap.progress = { step: 'saving', label: 'Saving...', percent: 98 };
        this.emit(record);
        versionPath = await writeNextVersion(target.folderPath, result.text);
        snap.folderPath = target.folderPath;

        await appendChatTurns(target.folderPath, [
          { role: 'user', content: record.request.prompt },
          { role: 'assistant', content: `Applied ${record.request.kind === 'fix' ? 'fix' : 'edit'} — saved as ${path.basename(versionPath)}.` },
        ]).catch(() => {});
      }

      if (result.debugLog) {
        await writeDebugSidecar(versionPath, {
          model: result.model,
          durationMs: result.durationMs,
          timestamp: new Date().toISOString(),
          prompt: record.request.prompt,
          turns: result.debugLog,
          steps: result.steps,
          plan: result.plan,
          mode: result.mode,
          libraries: result.libraries,
          verified: result.verified,
          transpileValid: result.transpileValid,
          fixAttempts: result.fixAttempts,
          usage: result.usage,
        }).catch((err) => log.warn('Failed to write debug sidecar', { error: String(err) }));
      }

      snap.versionPath = versionPath;
      snap.mode = result.mode;
      if (result.usage) snap.usage = result.usage;
      snap.status = 'done';
      snap.progress = { step: 'done', label: 'Complete', percent: 100 };
      snap.completedAt = Date.now();
      this.emit(record);
      log.info('Job complete', { id: snap.id, kind: snap.kind, folder: snap.folderPath });
    } catch (err) {
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
    } finally {
      this.schedulePersist();
      this.pump();
    }
  }
}

export const tsxJobEngine = new TsxJobEngine();
