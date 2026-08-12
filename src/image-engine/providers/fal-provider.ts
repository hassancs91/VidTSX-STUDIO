import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  ImageOperation,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import { FalClient, FalHttpError } from '@shared/providers/fal';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';

interface FalModelDef {
  id: string;
  name: string;
  supportedOperations: ImageOperation[];
  endpoints: Partial<Record<ImageOperation, string>>;
  sizeParam: 'aspect_ratio' | 'image_size';
}

/**
 * Rich definitions for the well-known fal models (exact endpoints + size
 * dialect). Catalog entries matching one of these ids use the rich def;
 * user-added ids get a generic def derived from fal conventions.
 */
const KNOWN_FAL_MODELS: FalModelDef[] = [
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'fal-ai/nano-banana-pro',
      'image-to-image': 'fal-ai/nano-banana-pro/edit',
      'multi-reference': 'fal-ai/nano-banana-pro/edit',
    },
    sizeParam: 'aspect_ratio',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'fal-ai/nano-banana-2',
      'image-to-image': 'fal-ai/nano-banana-2/edit',
      'multi-reference': 'fal-ai/nano-banana-2/edit',
    },
    sizeParam: 'aspect_ratio',
  },
  {
    id: 'seedream-v4.5',
    name: 'SeedREAM v4.5',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'fal-ai/bytedance/seedream/v4.5/text-to-image',
      'image-to-image': 'fal-ai/bytedance/seedream/v4.5/edit',
      'multi-reference': 'fal-ai/bytedance/seedream/v4.5/edit',
    },
    sizeParam: 'image_size',
  },
];

interface FalImageResult {
  url: string;
  width: number | null;
  height: number | null;
  content_type?: string;
}

interface FalResponse {
  images: FalImageResult[];
}

/**
 * Def for a catalog entry with no rich definition: endpoint from fal
 * conventions (`fal-ai/<id>` unless the id already looks like a path, `/edit`
 * for image-input operations) and the classic `image_size` parameter.
 */
function genericFalDef(entry: ImageModelCatalogEntry): FalModelDef {
  const base = entry.id.includes('/') ? entry.id : `fal-ai/${entry.id}`;
  return {
    id: entry.id,
    name: entry.name || entry.id,
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': base,
      'image-to-image': `${base}/edit`,
      'multi-reference': `${base}/edit`,
    },
    sizeParam: 'image_size',
  };
}

export class FalImageProvider implements ImageProvider {
  private readonly client: FalClient;
  private readonly models: FalModelDef[];

  constructor(
    readonly id: string,
    apiKey: string,
    private defaultModel: string,
    catalog?: ImageModelCatalogEntry[],
  ) {
    this.client = new FalClient({ apiKey });
    this.models = catalog?.length
      ? catalog.map((entry) => KNOWN_FAL_MODELS.find((m) => m.id === entry.id) ?? genericFalDef(entry))
      : KNOWN_FAL_MODELS;
  }

  getSupportedModels(): ImageModelInfo[] {
    return this.models.map((m) => ({
      id: m.id,
      name: m.name,
      supportedOperations: m.supportedOperations,
      endpoints: m.endpoints,
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

    const endpoint = modelDef.endpoints[request.operation];
    if (!endpoint) {
      throw new ImageEngineError(
        `Model "${modelId}" does not support operation "${request.operation}"`,
        this.id
      );
    }

    const body = this.buildRequestBody(modelDef, request);

    try {
      const response = await this.client.post<FalResponse>(endpoint, body, request.signal);
      const images = await this.fetchImages(
        response.images,
        request.width ?? 1024,
        request.height ?? 1024,
        request.signal,
      );

      return {
        images,
        model: modelId,
        provider: this.id,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      if (error instanceof FalHttpError) {
        throw new ImageEngineError(error.message, this.id, error.statusCode, error.cause ?? error);
      }
      throw error;
    }
  }

  private buildRequestBody(
    modelDef: FalModelDef,
    request: ImageGenerationRequest
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      prompt: request.prompt,
      num_images: request.numImages ?? 1,
    };

    if (request.outputFormat) {
      base.output_format = request.outputFormat;
    }

    if (modelDef.sizeParam === 'aspect_ratio') {
      base.aspect_ratio = this.computeAspectRatio(request.width, request.height);
    } else {
      base.image_size = {
        width: request.width ?? 1024,
        height: request.height ?? 1024,
      };
    }

    // Attach input images for edit operations
    if (request.operation === 'image-to-image' && request.sourceImage) {
      base.image_urls = [this.toDataUri(request.sourceImage)];
    } else if (request.operation === 'multi-reference' && request.referenceImages) {
      base.image_urls = request.referenceImages.map((img) => this.toDataUri(img));
    }

    return base;
  }

  private computeAspectRatio(width?: number, height?: number): string {
    if (!width || !height) return '1:1';
    const ratio = width / height;
    if (ratio > 2) return '21:9';
    if (ratio > 1.6) return '16:9';
    if (ratio > 1.2) return '4:3';
    if (ratio > 0.9) return '1:1';
    if (ratio > 0.6) return '3:4';
    return '9:16';
  }

  private toDataUri(base64: string): string {
    if (base64.startsWith('data:')) return base64;
    const contentType = this.detectContentType(base64);
    return `data:${contentType};base64,${base64}`;
  }

  private detectContentType(base64: string): string {
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('UklGR')) return 'image/webp';
    return 'image/png';
  }

  private async fetchImages(
    images: FalImageResult[],
    fallbackWidth: number,
    fallbackHeight: number,
    signal?: AbortSignal,
  ): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];

    for (const img of images) {
      const { base64, contentType } = await this.client.downloadAsBase64(img.url, signal);
      results.push({
        base64,
        width: img.width ?? fallbackWidth,
        height: img.height ?? fallbackHeight,
        contentType: img.content_type ?? contentType,
      });
    }

    return results;
  }
}
