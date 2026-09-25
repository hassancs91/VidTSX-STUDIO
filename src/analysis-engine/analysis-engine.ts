import { utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';
import type { FilterFace } from '../shared/types/studio-effects';
import type { AnalysisProvider, AnalysisWorkerRequest, AnalysisWorkerResponse, FaceModelPaths } from './types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export interface AnalysisLoadResult {
  ep: AnalysisProvider;
  loadMs: number;
  /** Set when DirectML failed to initialise and the CPU took over — a finding the job records. */
  fallback?: string;
}

type ModelGroup = 'faces' | 'masks';

/**
 * Host for the analysis process (`worker.ts`) — the Content Safety engine's
 * shape: lazy spawn, requestId-correlated pending map, process death rejects
 * everything and respawns on the next use. The warm ONNX sessions live in
 * the child — the face pair and MODNet load independently, each on its own
 * best provider; callers see Face records and 8-bit masks.
 *
 * The child is released (killed) when no job has needed it for a while, so
 * the GPU and ~200 MB of process are not held by an editor that applied one
 * filter an hour ago. The next job spawns and loads again (≈1–2 s on DML).
 */
class AnalysisEngine {
  private child: UtilityProcess | null = null;
  private loaded: Partial<Record<ModelGroup, AnalysisLoadResult>> = {};
  private loading: Partial<Record<ModelGroup, Promise<AnalysisLoadResult>>> = {};
  private pending = new Map<string, PendingRequest>();
  private releaseTimer: NodeJS.Timeout | null = null;

  private ensureProcess(): UtilityProcess {
    if (!this.child) {
      const child = utilityProcess.fork(path.join(__dirname, 'analysis-worker.js'), [], {
        serviceName: 'vidtsx-analysis',
      });
      child.on('message', (msg: AnalysisWorkerResponse) => this.handleMessage(msg));
      // Only the CURRENT child's death clears state: a released child exits
      // after `terminate` has already cleaned up, maybe after a new one spawned.
      child.on('exit', (code: number) => {
        if (this.child === child) this.handleProcessDeath(new Error(`Analysis process exited (code ${code})`));
      });
      this.child = child;
    }
    return this.child;
  }

  private settle(requestId: string, value: unknown, error?: Error): void {
    const req = this.pending.get(requestId);
    if (!req) return;
    this.pending.delete(requestId);
    if (error) req.reject(error);
    else req.resolve(value);
  }

  private handleMessage(msg: AnalysisWorkerResponse): void {
    switch (msg.type) {
      case 'loaded':
        this.settle(msg.requestId, { ep: msg.ep, loadMs: msg.loadMs, ...(msg.fallback ? { fallback: msg.fallback } : {}) });
        break;
      case 'facesResult':
        this.settle(msg.requestId, msg.faces);
        break;
      case 'maskResult':
        this.settle(msg.requestId, { mask: msg.mask instanceof Uint8Array ? msg.mask : new Uint8Array(msg.mask as ArrayBufferLike), ms: msg.ms, inferMs: msg.inferMs });
        break;
      case 'released':
        this.loaded = {};
        break;
      case 'error':
        if (msg.requestId) this.settle(msg.requestId, undefined, new Error(msg.error));
        break;
    }
  }

  private handleProcessDeath(err: Error): void {
    for (const [, req] of this.pending) req.reject(err);
    this.pending.clear();
    this.child = null;
    this.loaded = {};
    this.loading = {};
  }

  /** Post a request and wait for its correlated answer. */
  private call<T>(build: (requestId: string) => AnalysisWorkerRequest): Promise<T> {
    const requestId = randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.ensureProcess().postMessage(build(requestId));
    });
  }

  /** Load (or reuse) one group's sessions. Concurrent callers share one in-flight load. */
  private load(group: ModelGroup, build: (requestId: string) => AnalysisWorkerRequest): Promise<AnalysisLoadResult> {
    this.cancelRelease();
    const done = this.loaded[group];
    if (done) return Promise.resolve(done);
    let inflight = this.loading[group];
    if (!inflight) {
      inflight = this.call<AnalysisLoadResult>(build).then(
        (result) => {
          this.loaded[group] = result;
          delete this.loading[group];
          return result;
        },
        (err: unknown) => {
          delete this.loading[group];
          throw err;
        },
      );
      this.loading[group] = inflight;
    }
    return inflight;
  }

  /** Load (or reuse) the face sessions (YuNet + mesh). */
  loadFaces(models: FaceModelPaths, preferGpu = true): Promise<AnalysisLoadResult> {
    return this.load('faces', (requestId) => ({ type: 'loadFaces', requestId, models, preferGpu }));
  }

  /** Load (or reuse) the MODNet session. */
  loadMasks(model: string, preferGpu = true): Promise<AnalysisLoadResult> {
    return this.load('masks', (requestId) => ({ type: 'loadMasks', requestId, model, preferGpu }));
  }

  /**
   * The faces in one frame — tightly packed RGB24 of width × height pixels,
   * structured-cloned to the child (~1.5 MB at 960×512, well under the ~25 ms
   * the frame costs). Records are normalised to the frame.
   */
  async faces(rgb: Uint8Array, width: number, height: number, maxFaces: number, refinePasses = 1): Promise<FilterFace[]> {
    if (!this.loaded.faces) throw new Error('Face models are not loaded');
    return this.call<FilterFace[]>((requestId) => ({ type: 'faces', requestId, width, height, rgb, maxFaces, refinePasses }));
  }

  /**
   * The subject mask of one frame: RGB24 at MODNet's input size in, the
   * matte area-averaged to `maskWidth × maskHeight` 8-bit alpha out, with
   * the worker's own time for it (inference + resample — the job logs it
   * beside its wall time).
   */
  async mask(rgb: Uint8Array, width: number, height: number, maskWidth: number, maskHeight: number): Promise<{ mask: Uint8Array; ms: number; inferMs: number }> {
    if (!this.loaded.masks) throw new Error('The subject model is not loaded');
    return this.call<{ mask: Uint8Array; ms: number; inferMs: number }>((requestId) => ({ type: 'mask', requestId, width, height, rgb, maskWidth, maskHeight }));
  }

  /** Kill the child after `ms` of no further loads — a job calls this when it is done. */
  scheduleRelease(ms = 60_000): void {
    this.cancelRelease();
    if (!this.child) return;
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.pending.size === 0 && !this.loading.faces && !this.loading.masks) void this.terminate();
    }, ms);
    this.releaseTimer.unref?.();
  }

  private cancelRelease(): void {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  async terminate(): Promise<void> {
    this.cancelRelease();
    if (this.child) {
      const child = this.child;
      this.child = null;
      child.kill();
      this.loaded = {};
      this.loading = {};
      for (const [, req] of this.pending) req.reject(new Error('Analysis process terminated'));
      this.pending.clear();
    }
  }
}

export const analysisEngine = new AnalysisEngine();
