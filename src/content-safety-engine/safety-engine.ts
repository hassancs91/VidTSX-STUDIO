import { Worker } from 'worker_threads';
import path from 'path';
import { randomUUID } from 'crypto';
import type { SafetyModelConfig, SafetyWorkerRequest, SafetyWorkerResponse } from './types';

interface PendingRequest {
  resolve: (nsfwProbability: number) => void;
  reject: (err: Error) => void;
}

/**
 * Host for the Content Safety classifier worker (embedding-engine pattern:
 * lazy worker_threads spawn, requestId-correlated pending map, worker error
 * rejects everything and respawns on next use). The warm ONNX session lives
 * in the worker; callers only ever see p(NSFW).
 */
class SafetyEngine {
  private worker: Worker | null = null;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private loadResolve: (() => void) | null = null;
  private loadReject: ((err: Error) => void) | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(path.join(__dirname, 'content-safety-worker.js'));
      this.worker.on('message', (msg: SafetyWorkerResponse) => this.handleMessage(msg));
      this.worker.on('error', (err: Error) => this.handleWorkerError(err));
    }
    return this.worker;
  }

  private handleMessage(msg: SafetyWorkerResponse): void {
    switch (msg.type) {
      case 'modelLoaded': {
        this.loaded = true;
        this.loadResolve?.();
        this.loadResolve = null;
        this.loadReject = null;
        break;
      }
      case 'classifyResult': {
        const req = this.pending.get(msg.requestId);
        if (req) {
          this.pending.delete(msg.requestId);
          req.resolve(msg.nsfwProbability);
        }
        break;
      }
      case 'error': {
        const error = new Error(msg.error);
        if (msg.requestId) {
          const req = this.pending.get(msg.requestId);
          if (req) {
            this.pending.delete(msg.requestId);
            req.reject(error);
          }
        } else {
          this.loadReject?.(error);
          this.loadResolve = null;
          this.loadReject = null;
          this.loadPromise = null;
        }
        break;
      }
    }
  }

  private handleWorkerError(err: Error): void {
    for (const [, req] of this.pending) {
      req.reject(err);
    }
    this.pending.clear();
    this.loadReject?.(err);
    this.loadResolve = null;
    this.loadReject = null;
    this.worker = null;
    this.loaded = false;
    this.loadPromise = null;
  }

  private sendToWorker(msg: SafetyWorkerRequest, transfer?: ArrayBuffer[]): void {
    this.ensureWorker().postMessage(msg, transfer);
  }

  /** Idempotent; concurrent callers share one in-flight load. */
  async loadModel(modelPath: string, config: SafetyModelConfig): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = new Promise<void>((resolve, reject) => {
        this.loadResolve = resolve;
        this.loadReject = reject;
        this.sendToWorker({ type: 'loadModel', modelPath, config });
      });
    }
    return this.loadPromise;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Classify raw RGB24 bytes (already resized to the model's input size).
   * Resolves to p(NSFW). The buffer is transferred, not copied.
   */
  async classify(rgb: Uint8Array): Promise<number> {
    if (!this.loaded) {
      throw new Error('Safety model not loaded');
    }
    const requestId = randomUUID();
    return new Promise<number>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.sendToWorker({ type: 'classify', requestId, rgb }, [rgb.buffer as ArrayBuffer]);
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.loaded = false;
      this.loadPromise = null;
      this.pending.clear();
    }
  }
}

export const safetyEngine = new SafetyEngine();
