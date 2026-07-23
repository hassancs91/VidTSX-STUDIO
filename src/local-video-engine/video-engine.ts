import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { app } from 'electron';
import type { InstalledModel } from '@shared/model-library/types';
import type {
  ResolvedVideoModel,
  VideoGenerationProgress,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoModelMeta,
  VideoQueueItem,
  VideoRequestStatus,
} from './types';
import { runVideoCli, killActiveVideo, isVideoRunning } from './video-cli-runner';
import { SdCliError } from '../local-image-engine/sd-cli-failure';

/**
 * Injected by the video adapter (sdvideo-init): lists installed models and
 * resolves a model id into engine-consumable invocation data (absolute model +
 * companion paths). `resolve` throws typed errors for missing files/companions.
 */
export interface VideoModelResolver {
  list(): InstalledModel<VideoModelMeta>[];
  resolve(modelId: string): ResolvedVideoModel;
}

/**
 * Local video generation engine (Wan / LTX / LingBot via sd-cli `vid_gen`).
 * Mirrors ImageLocalEngine: serial queue, callback hooks re-wired per IPC call,
 * no Electron IPC knowledge here.
 */
export class VideoLocalEngine {
  private resolver: VideoModelResolver | null = null;
  private sdCliBinaryPath = '';
  private queue: VideoQueueItem[] = [];
  private processing = false;

  onProgress: ((progress: VideoGenerationProgress) => void) | null = null;
  onComplete: ((requestId: string, result: VideoGenerationResult) => void) | null = null;
  /** `code`/`details` are set for classified sd-cli runtime failures (raw output tail). */
  onError:
    | ((requestId: string, error: string, code?: string, details?: string) => void)
    | null = null;
  /** Fired after a successful generation so the adapter can record usage. */
  onModelUsed: ((modelId: string) => void) | null = null;

  initialize(resolver: VideoModelResolver, sdCliBinaryPath: string): void {
    this.resolver = resolver;
    this.sdCliBinaryPath = sdCliBinaryPath;
  }

  isSdCliAvailable(): boolean {
    return existsSync(this.sdCliBinaryPath);
  }

  getAvailableModels(): InstalledModel<VideoModelMeta>[] {
    return this.resolver?.list() ?? [];
  }

  enqueue(request: VideoGenerationRequest): string {
    const requestId = randomUUID();
    this.queue.push({ requestId, request, status: 'queued' });
    this.processNext();
    return requestId;
  }

  cancel(requestId: string): boolean {
    const idx = this.queue.findIndex((item) => item.requestId === requestId);
    if (idx === -1) return false;

    const item = this.queue[idx];
    if (item.status === 'queued') {
      item.status = 'cancelled';
      this.queue.splice(idx, 1);
      return true;
    }

    if (item.status === 'running') {
      item.status = 'cancelled';
      killActiveVideo();
      return true;
    }

    return false;
  }

  cancelAll(): void {
    if (isVideoRunning()) {
      killActiveVideo();
    }
    for (const item of this.queue) {
      if (item.status === 'queued' || item.status === 'running') {
        item.status = 'cancelled';
      }
    }
    this.queue = [];
    this.processing = false;
  }

  dispose(): void {
    this.cancelAll();
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.onModelUsed = null;
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const nextItem = this.queue.find((item) => item.status === 'queued');
    if (!nextItem) return;

    this.processing = true;
    nextItem.status = 'running';

    try {
      const result = await this.runGeneration(nextItem);
      nextItem.status = 'completed';
      this.onComplete?.(nextItem.requestId, result);
    } catch (err) {
      // Status may have been changed to 'cancelled' by cancel() during generation
      if ((nextItem.status as VideoRequestStatus) !== 'cancelled') {
        nextItem.status = 'failed';
        if (err instanceof SdCliError) {
          this.onError?.(nextItem.requestId, err.message, err.code, err.details);
        } else {
          const message = err instanceof Error ? err.message : 'Generation failed';
          this.onError?.(nextItem.requestId, message);
        }
      }
    } finally {
      this.queue = this.queue.filter((item) => item.status === 'queued');
      this.processing = false;
      this.processNext();
    }
  }

  private async runGeneration(item: VideoQueueItem): Promise<VideoGenerationResult> {
    const { request, requestId } = item;

    if (!this.isSdCliAvailable()) {
      throw new Error('sd-cli binary not installed');
    }
    if (!this.resolver) {
      throw new Error('Video engine not initialized');
    }

    // Absolute model + companion paths (throws typed errors when missing).
    const resolved = this.resolver.resolve(request.modelId);

    if (request.initImagePath && !resolved.capabilities.i2v) {
      throw new Error(`${request.modelId} does not support image-to-video`);
    }
    if (!request.initImagePath && !resolved.capabilities.t2v) {
      throw new Error(`${request.modelId} needs an input image (image-to-video only)`);
    }

    const tempDir = path.join(app.getPath('temp'), 'vidtsx-sdvideo');
    await fs.mkdir(tempDir, { recursive: true });
    const outputPath = path.join(tempDir, `${requestId}.webm`);

    const startTime = Date.now();

    const cliResult = await runVideoCli({
      sdCliBinaryPath: this.sdCliBinaryPath,
      resolved,
      request,
      outputPath,
      requestId,
      onProgress: (progress) => {
        this.onProgress?.(progress);
      },
    });

    this.onModelUsed?.(request.modelId);

    return {
      outputPath: cliResult.outputPath,
      width: request.width ?? resolved.defaults.width,
      height: request.height ?? resolved.defaults.height,
      frames: request.frames ?? resolved.defaults.frames,
      fps: request.fps ?? resolved.defaults.fps,
      seed: cliResult.seed,
      durationMs: Date.now() - startTime,
    };
  }
}

export const videoLocalEngine = new VideoLocalEngine();
