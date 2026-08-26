import { utilityProcess, type UtilityProcess } from 'electron';
import path from 'path';
import { randomUUID } from 'crypto';
import type { SafetyModelConfig, SafetyWorkerRequest, SafetyWorkerResponse } from './types';

interface PendingRequest {
  resolve: (nsfwProbability: number) => void;
  reject: (err: Error) => void;
}

/**
 * Host for the Content Safety classifier process. Uses an Electron
 * utilityProcess rather than a worker_thread ON PURPOSE: sherpa-onnx loads
 * its own older onnxruntime.dll, DLL resolution is per process, and the
 * 1.24.3 binding refuses to load into a process that already carries the
 * old DLL ("The operating system cannot run %1" — found live in the slice-5
 * smoke walk). A separate process side-steps the conflict entirely.
 *
 * Protocol and lifecycle mirror the embedding-engine pattern: lazy spawn,
 * requestId-correlated pending map, process death rejects everything and
 * respawns on next use. The warm ONNX session lives in the child; callers
 * only ever see p(NSFW).
 */
class SafetyEngine {
  private child: UtilityProcess | null = null;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private pending = new Map<string, PendingRequest>();
  private loadResolve: (() => void) | null = null;
  private loadReject: ((err: Error) => void) | null = null;

  private ensureProcess(): UtilityProcess {
    if (!this.child) {
      this.child = utilityProcess.fork(path.join(__dirname, 'content-safety-worker.js'), [], {
        serviceName: 'vidtsx-content-safety',
      });
      this.child.on('message', (msg: SafetyWorkerResponse) => this.handleMessage(msg));
      this.child.on('exit', (code: number) =>
        this.handleProcessDeath(new Error(`Content Safety process exited (code ${code})`)),
      );
    }
    return this.child;
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

  private handleProcessDeath(err: Error): void {
    for (const [, req] of this.pending) {
      req.reject(err);
    }
    this.pending.clear();
    this.loadReject?.(err);
    this.loadResolve = null;
    this.loadReject = null;
    this.child = null;
    this.loaded = false;
    this.loadPromise = null;
  }

  private sendToProcess(msg: SafetyWorkerRequest): void {
    this.ensureProcess().postMessage(msg);
  }

  /** Idempotent; concurrent callers share one in-flight load. */
  async loadModel(modelPath: string, config: SafetyModelConfig): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = new Promise<void>((resolve, reject) => {
        this.loadResolve = resolve;
        this.loadReject = reject;
        this.sendToProcess({ type: 'loadModel', modelPath, config });
      });
    }
    return this.loadPromise;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Classify raw RGB24 bytes (already resized to the model's input size).
   * Resolves to p(NSFW). Bytes are structured-cloned to the child (~440 KB
   * per frame — negligible next to inference time).
   */
  async classify(rgb: Uint8Array): Promise<number> {
    if (!this.loaded) {
      throw new Error('Safety model not loaded');
    }
    const requestId = randomUUID();
    return new Promise<number>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.sendToProcess({ type: 'classify', requestId, rgb });
    });
  }

  async terminate(): Promise<void> {
    if (this.child) {
      this.child.kill();
      this.child = null;
      this.loaded = false;
      this.loadPromise = null;
      this.pending.clear();
    }
  }
}

export const safetyEngine = new SafetyEngine();
