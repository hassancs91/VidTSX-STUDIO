import { utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';
import type { FilterFace } from '../shared/types/studio-effects';
import type { AnalysisProvider, AnalysisWorkerRequest, AnalysisWorkerResponse, FaceModelPaths } from './types';

interface PendingRequest {
  resolve: (faces: FilterFace[]) => void;
  reject: (err: Error) => void;
}

export interface FacesLoadResult {
  ep: AnalysisProvider;
  loadMs: number;
  /** Set when DirectML failed to initialise and the CPU took over — a finding the job records. */
  fallback?: string;
}

/**
 * Host for the analysis process (`worker.ts`) — the Content Safety engine's
 * shape: lazy spawn, requestId-correlated pending map, process death rejects
 * everything and respawns on the next use. The warm ONNX sessions live in
 * the child; callers see Face records.
 *
 * The child is released (killed) when no job has needed it for a while, so
 * the GPU and ~200 MB of process are not held by an editor that applied one
 * filter an hour ago. The next job spawns and loads again (≈1–2 s on DML).
 */
class AnalysisEngine {
  private child: UtilityProcess | null = null;
  private loaded: FacesLoadResult | null = null;
  private loadPromise: Promise<FacesLoadResult> | null = null;
  private loadSettle: { resolve: (r: FacesLoadResult) => void; reject: (err: Error) => void } | null = null;
  private pending = new Map<string, PendingRequest>();
  private releaseTimer: NodeJS.Timeout | null = null;

  private ensureProcess(): UtilityProcess {
    if (!this.child) {
      this.child = utilityProcess.fork(path.join(__dirname, 'analysis-worker.js'), [], {
        serviceName: 'vidtsx-analysis',
      });
      this.child.on('message', (msg: AnalysisWorkerResponse) => this.handleMessage(msg));
      this.child.on('exit', (code: number) => this.handleProcessDeath(new Error(`Analysis process exited (code ${code})`)));
    }
    return this.child;
  }

  private handleMessage(msg: AnalysisWorkerResponse): void {
    switch (msg.type) {
      case 'facesLoaded': {
        this.loaded = { ep: msg.ep, loadMs: msg.loadMs, ...(msg.fallback ? { fallback: msg.fallback } : {}) };
        this.loadSettle?.resolve(this.loaded);
        this.loadSettle = null;
        break;
      }
      case 'facesResult': {
        const req = this.pending.get(msg.requestId);
        if (req) {
          this.pending.delete(msg.requestId);
          req.resolve(msg.faces);
        }
        break;
      }
      case 'released':
        this.loaded = null;
        break;
      case 'error': {
        const error = new Error(msg.error);
        if (msg.requestId) {
          const req = this.pending.get(msg.requestId);
          if (req) {
            this.pending.delete(msg.requestId);
            req.reject(error);
          }
        } else {
          this.loadSettle?.reject(error);
          this.loadSettle = null;
          this.loadPromise = null;
        }
        break;
      }
    }
  }

  private handleProcessDeath(err: Error): void {
    for (const [, req] of this.pending) req.reject(err);
    this.pending.clear();
    this.loadSettle?.reject(err);
    this.loadSettle = null;
    this.child = null;
    this.loaded = null;
    this.loadPromise = null;
  }

  private post(msg: AnalysisWorkerRequest): void {
    this.ensureProcess().postMessage(msg);
  }

  /** The provider the loaded sessions run on, or null while nothing is loaded. */
  provider(): AnalysisProvider | null {
    return this.loaded?.ep ?? null;
  }

  /** Load (or reuse) the face sessions. Concurrent callers share one in-flight load. */
  async loadFaces(models: FaceModelPaths, preferGpu = true): Promise<FacesLoadResult> {
    this.cancelRelease();
    if (this.loaded) return this.loaded;
    if (!this.loadPromise) {
      this.loadPromise = new Promise<FacesLoadResult>((resolve, reject) => {
        this.loadSettle = { resolve, reject };
        this.post({ type: 'loadFaces', models, preferGpu });
      });
    }
    return this.loadPromise;
  }

  /**
   * The faces in one frame — tightly packed RGB24 of width × height pixels,
   * structured-cloned to the child (~1.5 MB at 960×512, well under the ~25 ms
   * the frame costs). Records are normalised to the frame.
   */
  async faces(rgb: Uint8Array, width: number, height: number, maxFaces: number, refinePasses = 1): Promise<FilterFace[]> {
    if (!this.loaded) throw new Error('Face models are not loaded');
    const requestId = randomUUID();
    return new Promise<FilterFace[]>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.post({ type: 'faces', requestId, width, height, rgb, maxFaces, refinePasses });
    });
  }

  /** Kill the child after `ms` of no further loads — a job calls this when it is done. */
  scheduleRelease(ms = 60_000): void {
    this.cancelRelease();
    if (!this.child) return;
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.pending.size === 0 && !this.loadPromise) void this.terminate();
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
      this.loaded = null;
      this.loadPromise = null;
      this.loadSettle = null;
      for (const [, req] of this.pending) req.reject(new Error('Analysis process terminated'));
      this.pending.clear();
    }
  }
}

export const analysisEngine = new AnalysisEngine();
