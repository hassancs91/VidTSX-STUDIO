import { Worker } from 'worker_threads';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
  EmbedRequest,
  EmbedResult,
} from './types';

interface PendingRequest {
  resolve: (value: EmbedResult) => void;
  reject: (err: Error) => void;
}

class EmbeddingEngine {
  private worker: Worker | null = null;
  private loadedModelId: string | null = null;
  private pending = new Map<string, PendingRequest>();
  private loadResolve: ((modelId: string) => void) | null = null;
  private loadReject: ((err: Error) => void) | null = null;
  private unloadResolve: (() => void) | null = null;
  private unloadReject: ((err: Error) => void) | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(path.join(__dirname, 'embedding-worker.js'));
      this.worker.on('message', (msg: EmbeddingWorkerResponse) =>
        this.handleMessage(msg),
      );
      this.worker.on('error', (err: Error) => this.handleWorkerError(err));
    }
    return this.worker;
  }

  private handleMessage(msg: EmbeddingWorkerResponse): void {
    switch (msg.type) {
      case 'modelLoaded': {
        this.loadedModelId = msg.modelId;
        this.loadResolve?.(msg.modelId);
        this.loadResolve = null;
        this.loadReject = null;
        break;
      }
      case 'embedResult': {
        const req = this.pending.get(msg.requestId);
        if (req) {
          this.pending.delete(msg.requestId);
          req.resolve({
            embeddings: msg.embeddings,
            dimensions: msg.dimensions,
            modelId: this.loadedModelId!,
          });
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
          // Model load/unload error
          this.loadReject?.(error);
          this.loadResolve = null;
          this.loadReject = null;
          this.unloadReject?.(error);
          this.unloadResolve = null;
          this.unloadReject = null;
        }
        break;
      }
      case 'modelUnloaded': {
        this.loadedModelId = null;
        this.unloadResolve?.();
        this.unloadResolve = null;
        this.unloadReject = null;
        break;
      }
    }
  }

  private handleWorkerError(err: Error): void {
    // Reject all pending requests
    for (const [, req] of this.pending) {
      req.reject(err);
    }
    this.pending.clear();
    this.loadReject?.(err);
    this.loadResolve = null;
    this.loadReject = null;
    this.unloadReject?.(err);
    this.unloadResolve = null;
    this.unloadReject = null;
    this.worker = null;
    this.loadedModelId = null;
  }

  private sendToWorker(msg: EmbeddingWorkerRequest): void {
    this.ensureWorker().postMessage(msg);
  }

  async loadModel(modelId: string, modelPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      this.sendToWorker({ type: 'loadModel', modelId, modelPath });
    });
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    if (!this.loadedModelId) {
      throw new Error('No embedding model loaded');
    }
    const requestId = randomUUID();
    return new Promise<EmbedResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.sendToWorker({
        type: 'embed',
        requestId,
        texts: request.texts,
        normalize: request.normalize ?? true,
      });
    });
  }

  async unloadModel(): Promise<void> {
    if (!this.loadedModelId) return;
    return new Promise<void>((resolve, reject) => {
      this.unloadResolve = resolve;
      this.unloadReject = reject;
      this.sendToWorker({ type: 'unloadModel' });
    });
  }

  getLoadedModelId(): string | null {
    return this.loadedModelId;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.loadedModelId = null;
      this.pending.clear();
    }
  }
}

export const embeddingEngine = new EmbeddingEngine();
