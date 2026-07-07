import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { app } from 'electron';
import type {
  SdModelDefinition,
  SdGenerationRequest,
  SdGenerationResult,
  SdGenerationProgress,
  SdQueueItem,
  SdRequestStatus,
} from './types';
import { SD_MODEL_CATALOG } from './model-registry';
import { runSdCli, killActive, isRunning } from './sd-cli-runner';

export class ImageLocalEngine {
  private modelsBasePath = '';
  private sdCliBinaryPath = '';
  private activeModelId: string | null = null;
  private queue: SdQueueItem[] = [];
  private processing = false;

  onProgress: ((progress: SdGenerationProgress) => void) | null = null;
  onComplete: ((requestId: string, result: SdGenerationResult) => void) | null = null;
  onError: ((requestId: string, error: string) => void) | null = null;

  initialize(modelsBasePath: string, sdCliBinaryPath: string): void {
    this.modelsBasePath = modelsBasePath;
    this.sdCliBinaryPath = sdCliBinaryPath;
  }

  isSdCliAvailable(): boolean {
    return existsSync(this.sdCliBinaryPath);
  }

  getSdCliPath(): string {
    return this.sdCliBinaryPath;
  }

  getAvailableModels(): SdModelDefinition[] {
    return SD_MODEL_CATALOG.filter((m) => !m.hidden);
  }

  getModelInfo(modelId: string): SdModelDefinition | undefined {
    return SD_MODEL_CATALOG.find((m) => m.id === modelId);
  }

  getActiveModelId(): string | null {
    return this.activeModelId;
  }

  setActiveModel(modelId: string): void {
    const model = this.getModelInfo(modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    this.activeModelId = modelId;
  }

  enqueue(request: SdGenerationRequest): string {
    const requestId = randomUUID();
    this.queue.push({
      requestId,
      request,
      status: 'queued',
    });
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
      killActive();
      return true;
    }

    return false;
  }

  cancelAll(): void {
    // Kill active process
    if (isRunning()) {
      killActive();
    }
    // Clear queue
    for (const item of this.queue) {
      if (item.status === 'queued' || item.status === 'running') {
        item.status = 'cancelled';
      }
    }
    this.queue = [];
    this.processing = false;
  }

  getQueue(): SdQueueItem[] {
    return [...this.queue];
  }

  dispose(): void {
    this.cancelAll();
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
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
      if ((nextItem.status as SdRequestStatus) !== 'cancelled') {
        nextItem.status = 'failed';
        const message = err instanceof Error ? err.message : 'Generation failed';
        this.onError?.(nextItem.requestId, message);
      }
    } finally {
      // Remove completed/failed/cancelled items from queue
      this.queue = this.queue.filter(
        (item) => item.status === 'queued',
      );
      this.processing = false;
      this.processNext();
    }
  }

  private async runGeneration(item: SdQueueItem): Promise<SdGenerationResult> {
    const { request, requestId } = item;
    const modelId = request.modelId ?? this.activeModelId;

    if (!modelId) {
      throw new Error('No model selected');
    }

    const modelDef = this.getModelInfo(modelId);
    if (!modelDef) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (!this.isSdCliAvailable()) {
      throw new Error('sd-cli binary not installed');
    }

    const modelFilePath = path.join(
      this.modelsBasePath,
      modelDef.extractedName,
      modelDef.modelFileName,
    );

    if (!existsSync(modelFilePath)) {
      throw new Error(`Model file not found: ${modelFilePath}`);
    }

    // Create temp output directory
    const tempDir = path.join(app.getPath('temp'), 'vidtsx-sdimage');
    await fs.mkdir(tempDir, { recursive: true });

    const format = request.outputFormat ?? 'png';
    const outputPath = path.join(tempDir, `${requestId}.${format}`);

    const startTime = Date.now();

    const cliResult = await runSdCli({
      sdCliBinaryPath: this.sdCliBinaryPath,
      modelFilePath,
      modelDef,
      request,
      outputPath,
      modelsBasePath: this.modelsBasePath,
      requestId,
      onProgress: (progress) => {
        this.onProgress?.(progress);
      },
    });

    const durationMs = Date.now() - startTime;

    // Read generated image as base64
    const imageBuffer = await fs.readFile(cliResult.outputPath);
    const imageBase64 = imageBuffer.toString('base64');

    return {
      outputPath: cliResult.outputPath,
      imageBase64,
      width: request.width ?? modelDef.defaults.width,
      height: request.height ?? modelDef.defaults.height,
      seed: cliResult.seed,
      durationMs,
    };
  }
}

export const imageLocalEngine = new ImageLocalEngine();
