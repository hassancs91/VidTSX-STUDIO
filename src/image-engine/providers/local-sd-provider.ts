import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  ImageOperation,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import type { SdGenerationRequest } from '../../local-image-engine';
import { imageLocalEngine } from '../../local-image-engine';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('LocalSdProvider');

/**
 * Optional hook applied to each sd-cli request before it is enqueued. The main
 * process injects the VRAM/RAM preflight here (block "won't fit", auto-enable
 * CPU offload) so this provider stays free of main-process imports.
 */
export type SdRequestPreparer = (request: SdGenerationRequest) => Promise<SdGenerationRequest>;

/** sd.cpp requires dimensions that are multiples of 64. */
function snap64(value: number): number {
  return Math.max(64, Math.round(value / 64) * 64);
}

/** Strip an optional data-URI prefix, leaving raw base64. */
function rawBase64(data: string): string {
  const comma = data.indexOf(',');
  return data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
}

/**
 * Bridges the local sd-cli engine into the cloud ImageEngine provider
 * interface, so the Image Studio (and anything else on the `image:generate`
 * IPC) can target on-device open-source models exactly like a cloud provider.
 * Mirrors `LocalLlmProvider` for the LLM engine. Requests serialize through
 * the local engine's queue — one sd-cli process runs at a time.
 */
export class LocalSdImageProvider implements ImageProvider {
  readonly id: string;

  private readonly prepare?: SdRequestPreparer;

  constructor(id: string, options?: { prepare?: SdRequestPreparer }) {
    this.id = id;
    this.prepare = options?.prepare;
  }

  getSupportedModels(): ImageModelInfo[] {
    if (!imageLocalEngine.isSdCliAvailable()) return [];
    return imageLocalEngine
      .getAvailableModels()
      .filter((m) => m.issues.length === 0)
      .map((m) => {
        const supportedOperations: ImageOperation[] = [];
        if (m.meta.capabilities.txt2img) supportedOperations.push('text-to-image');
        if (m.meta.capabilities.img2img) supportedOperations.push('image-to-image');
        return {
          id: m.id,
          name: m.name,
          supportedOperations,
          endpoints: {},
        };
      });
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!imageLocalEngine.isSdCliAvailable()) {
      throw new ImageEngineError(
        'sd-cli is not installed. Set it up in AI Models → Image first.',
        this.id,
      );
    }

    const models = this.getSupportedModels();
    const modelId =
      request.model || imageLocalEngine.getActiveModelId() || models[0]?.id;
    if (!modelId) {
      throw new ImageEngineError(
        'No local image model is ready. Download one in AI Models → Image first.',
        this.id,
      );
    }

    const model = models.find((m) => m.id === modelId);
    if (model && !model.supportedOperations.includes(request.operation)) {
      throw new ImageEngineError(
        `The local model "${model.name}" does not support ${request.operation}.`,
        this.id,
      );
    }
    if (request.operation === 'multi-reference') {
      throw new ImageEngineError(
        'Reference-image generation is not supported by local models yet — use a cloud provider.',
        this.id,
      );
    }

    // img2img needs the source image on disk for sd-cli.
    let sourceImagePath: string | undefined;
    if (request.operation === 'image-to-image') {
      if (!request.sourceImage) {
        throw new ImageEngineError('Source image is required for image-to-image.', this.id);
      }
      const tempDir = path.join(os.tmpdir(), 'vidtsx-sdimage');
      await fs.mkdir(tempDir, { recursive: true });
      sourceImagePath = path.join(tempDir, `src-${randomUUID()}.png`);
      await fs.writeFile(sourceImagePath, Buffer.from(rawBase64(request.sourceImage), 'base64'));
    }

    const numImages = Math.max(1, request.numImages ?? 1);
    const images: GeneratedImage[] = [];
    const startTime = Date.now();

    try {
      for (let i = 0; i < numImages; i++) {
        if (request.signal?.aborted) {
          throw new ImageEngineError('Image generation cancelled', this.id);
        }

        let sdRequest: SdGenerationRequest = {
          operation: request.operation === 'image-to-image' ? 'img2img' : 'txt2img',
          prompt: request.prompt,
          modelId,
          width: request.width !== undefined ? snap64(request.width) : undefined,
          height: request.height !== undefined ? snap64(request.height) : undefined,
          // Explicit random seed per image — sd-cli's fixed default would make
          // every image of a multi-image request identical.
          seed: Math.floor(Math.random() * 2147483647),
          sourceImagePath,
          outputFormat: request.outputFormat === 'jpeg' ? 'jpeg' : 'png',
        };
        if (this.prepare) {
          sdRequest = await this.prepare(sdRequest);
        }

        const { requestId, promise } = imageLocalEngine.enqueueAwait(sdRequest);
        const onAbort = () => imageLocalEngine.cancel(requestId);
        request.signal?.addEventListener('abort', onAbort, { once: true });

        try {
          const result = await promise;
          images.push({
            base64: result.imageBase64,
            width: result.width,
            height: result.height,
            contentType: sdRequest.outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
          });
        } finally {
          request.signal?.removeEventListener('abort', onAbort);
        }
      }
    } catch (err) {
      if (err instanceof ImageEngineError) throw err;
      const message = err instanceof Error ? err.message : 'Local image generation failed';
      log.warn('Generation failed', { modelId, error: message });
      throw new ImageEngineError(message, this.id, undefined, err);
    } finally {
      if (sourceImagePath) {
        fs.unlink(sourceImagePath).catch(() => {});
      }
    }

    return {
      images,
      model: modelId,
      provider: this.id,
      durationMs: Date.now() - startTime,
    };
  }
}
