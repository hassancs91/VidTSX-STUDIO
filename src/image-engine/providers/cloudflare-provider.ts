import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  ImageOperation,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import { CloudflareClient, CloudflareHttpError } from '@shared/providers/cloudflare';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import { IMAGE_DIALECT_DEFAULTS } from '@shared/presets/image-dialects';
import type { ImageModelParams } from '@shared/presets/image-model-params';

/**
 * Which of the dialect's parameters a model takes, and under which key.
 * Workers AI is one dialect with per-model field names: `steps` on the FLUX
 * apps, `num_steps` on SDXL Lightning and Lucid Origin; `negative_prompt`
 * only on SDXL. A user-added id gets the generic (steps + seed) set.
 */
export interface CloudflareParamKeys {
  steps?: 'steps' | 'num_steps';
  /** Hard cap the API enforces (flux-1-schnell: 8; sdxl-lightning: 20; lucid: 40). */
  maxSteps?: number;
  guidance?: boolean;
  seed?: boolean;
  negativePrompt?: boolean;
}

interface CloudflareModelDef {
  id: string;
  name: string;
  supportedOperations: ImageOperation[];
  /** flux-2 models take multipart form data (even prompt-only); the rest take JSON. */
  input: 'json' | 'multipart';
  /** flux-1-schnell has no width/height parameters at all. */
  size: 'none' | 'dimensions';
  params: CloudflareParamKeys;
}

/**
 * Rich definitions for the well-known Workers AI models (input dialect +
 * operations). Output dialect is NOT tracked here — the client sniffs the
 * response Content-Type, so user-added ids work with the generic def.
 */
const KNOWN_CLOUDFLARE_MODELS: CloudflareModelDef[] = [
  {
    id: '@cf/black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 Schnell',
    supportedOperations: ['text-to-image'],
    input: 'json',
    size: 'none',
    params: { steps: 'steps', maxSteps: 8, seed: true },
  },
  {
    id: '@cf/black-forest-labs/flux-2-klein-9b',
    name: 'FLUX.2 Klein 9B',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    input: 'multipart',
    size: 'dimensions',
    params: { steps: 'steps', guidance: true, seed: true },
  },
  {
    id: '@cf/black-forest-labs/flux-2-dev',
    name: 'FLUX.2 Dev',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    input: 'multipart',
    size: 'dimensions',
    params: { steps: 'steps', guidance: true, seed: true },
  },
  {
    id: '@cf/leonardo/lucid-origin',
    name: 'Lucid Origin',
    supportedOperations: ['text-to-image'],
    input: 'json',
    size: 'dimensions',
    params: { steps: 'num_steps', maxSteps: 40, guidance: true, seed: true },
  },
  {
    id: '@cf/bytedance/stable-diffusion-xl-lightning',
    name: 'SDXL Lightning',
    supportedOperations: ['text-to-image'],
    input: 'json',
    size: 'dimensions',
    params: { steps: 'num_steps', maxSteps: 20, guidance: true, seed: true, negativePrompt: true },
  },
];

/**
 * The dialect's parameters this model takes, keyed as the API spells them.
 * Exposed for unit tests.
 */
export function cloudflareParamFields(
  keys: CloudflareParamKeys,
  p: ImageModelParams | undefined,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!p) return out;
  if (p.steps !== undefined && keys.steps) {
    const steps = Math.max(1, Math.round(p.steps));
    out[keys.steps] = keys.maxSteps ? Math.min(keys.maxSteps, steps) : steps;
  }
  if (p.cfgScale !== undefined && keys.guidance) out.guidance = p.cfgScale;
  if (p.seed !== undefined && keys.seed) out.seed = Math.round(p.seed);
  if (p.negativePrompt && keys.negativePrompt) out.negative_prompt = p.negativePrompt;
  return out;
}

// flux-2 models accept at most 4 input images per request.
const MAX_INPUT_IMAGES = 4;

// Safe across the catalog: sdxl-lightning caps at 2048, lucid-origin at 2500.
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 2048;

/** Def for a catalog entry with no rich definition: plain JSON text-to-image. */
function genericCloudflareDef(entry: ImageModelCatalogEntry): CloudflareModelDef {
  return {
    id: entry.id,
    name: entry.name || entry.id,
    supportedOperations: ['text-to-image'],
    input: 'json',
    size: 'dimensions',
    params: { steps: 'steps', seed: true },
  };
}

export class CloudflareImageProvider implements ImageProvider {
  private readonly client: CloudflareClient;
  private readonly models: CloudflareModelDef[];

  constructor(
    readonly id: string,
    apiToken: string,
    accountId: string,
    readonly defaultModel: string,
    catalog?: ImageModelCatalogEntry[],
  ) {
    this.client = new CloudflareClient({ apiToken, accountId });
    this.models = catalog?.length
      ? catalog.map((entry) => KNOWN_CLOUDFLARE_MODELS.find((m) => m.id === entry.id) ?? genericCloudflareDef(entry))
      : KNOWN_CLOUDFLARE_MODELS;
  }

  getSupportedModels(): ImageModelInfo[] {
    return this.models.map((m) => ({
      id: m.id,
      name: m.name,
      supportedOperations: m.supportedOperations,
      endpoints: Object.fromEntries(m.supportedOperations.map((op) => [op, m.id])),
      paramSchema: IMAGE_DIALECT_DEFAULTS.cloudflare.paramSchema,
    }));
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    const modelId = request.model || this.defaultModel;
    const modelDef = this.models.find((m) => m.id === modelId);

    if (!modelDef) {
      throw new ImageEngineError(
        `Unknown model "${modelId}". Available: ${this.models.map((m) => m.id).join(', ')}`,
        this.id
      );
    }

    if (!modelDef.supportedOperations.includes(request.operation)) {
      throw new ImageEngineError(
        `Model "${modelId}" does not support operation "${request.operation}"`,
        this.id
      );
    }

    const width = this.clampDimension(request.width);
    const height = this.clampDimension(request.height);
    const count = Math.max(1, request.numImages ?? 1);
    const images: GeneratedImage[] = [];

    try {
      // Workers AI returns one image per run — loop for multi-image requests.
      for (let i = 0; i < count; i++) {
        const body = modelDef.input === 'multipart'
          ? this.buildFormBody(modelDef, request, width, height)
          : this.buildJsonBody(modelDef, request, width, height);
        const result = await this.client.runImage(modelDef.id, body, request.signal);
        images.push({
          base64: result.base64,
          width,
          height,
          contentType: result.contentType,
        });
      }
    } catch (error) {
      if (error instanceof CloudflareHttpError) {
        throw this.mapError(error);
      }
      throw error;
    }

    return {
      images,
      model: modelId,
      provider: this.id,
      durationMs: Date.now() - start,
    };
  }

  private buildJsonBody(
    modelDef: CloudflareModelDef,
    request: ImageGenerationRequest,
    width: number,
    height: number,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = { prompt: request.prompt };
    if (modelDef.size === 'dimensions') {
      body.width = width;
      body.height = height;
    }
    Object.assign(body, cloudflareParamFields(modelDef.params, request.params));
    return body;
  }

  private buildFormBody(
    modelDef: CloudflareModelDef,
    request: ImageGenerationRequest,
    width: number,
    height: number,
  ): FormData {
    const form = new FormData();
    form.append('prompt', request.prompt);
    if (modelDef.size === 'dimensions') {
      form.append('width', String(width));
      form.append('height', String(height));
    }
    for (const [key, value] of Object.entries(cloudflareParamFields(modelDef.params, request.params))) {
      form.append(key, String(value));
    }

    const inputImages =
      request.operation === 'image-to-image' && request.sourceImage
        ? [request.sourceImage]
        : request.operation === 'multi-reference' && request.referenceImages
          ? request.referenceImages.slice(0, MAX_INPUT_IMAGES)
          : [];
    inputImages.forEach((img, index) => {
      form.append(`input_image_${index}`, this.toBlob(img), `input_${index}.png`);
    });

    return form;
  }

  private clampDimension(value?: number): number {
    if (!value) return 1024;
    return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
  }

  private toBlob(base64: string): Blob {
    const raw = base64.startsWith('data:') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const buffer = Buffer.from(raw, 'base64');
    return new Blob([buffer], { type: this.detectContentType(raw) });
  }

  private detectContentType(base64: string): string {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  }

  private mapError(error: CloudflareHttpError): ImageEngineError {
    // Neuron exhaustion / rate limit → the free-tier allotment for the day is
    // spent (10k neurons/day free; flux-1-schnell ≈ 170 images).
    if (error.statusCode === 429 || /neuron/i.test(error.message)) {
      return new ImageEngineError(
        'Cloudflare daily free tier exhausted — Workers AI includes 10,000 free neurons per day, resetting at 00:00 UTC. Wait for the reset or enable paid usage in your Cloudflare dashboard.',
        this.id,
        error.statusCode,
        error,
      );
    }
    return new ImageEngineError(error.message, this.id, error.statusCode, error.cause ?? error);
  }
}
