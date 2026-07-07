import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  ImageOperation,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import { OpenRouterClient, OpenRouterHttpError } from '@shared/providers/openrouter';
import type { OpenRouterChatMessage, OpenRouterContentPart } from '@shared/providers/openrouter';

interface OpenRouterModelDef {
  id: string;
  name: string;
  supportedOperations: ImageOperation[];
  endpoints: Partial<Record<ImageOperation, string>>;
}

const OPENROUTER_MODELS: OpenRouterModelDef[] = [
  {
    id: 'black-forest-labs/flux.2-pro',
    name: 'FLUX.2 Pro',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'chat/completions',
      'image-to-image': 'chat/completions',
      'multi-reference': 'chat/completions',
    },
  },
  {
    id: 'black-forest-labs/flux.2-max',
    name: 'FLUX.2 Max',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'chat/completions',
      'image-to-image': 'chat/completions',
      'multi-reference': 'chat/completions',
    },
  },
  {
    id: 'black-forest-labs/flux.2-flex',
    name: 'FLUX.2 Flex',
    supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
    endpoints: {
      'text-to-image': 'chat/completions',
      'image-to-image': 'chat/completions',
      'multi-reference': 'chat/completions',
    },
  },
];

export class OpenRouterProvider implements ImageProvider {
  private readonly client: OpenRouterClient;

  constructor(
    readonly id: string,
    apiKey: string,
    private defaultModel: string
  ) {
    this.client = new OpenRouterClient({ apiKey });
  }

  getSupportedModels(): ImageModelInfo[] {
    const models: ImageModelInfo[] = OPENROUTER_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      supportedOperations: m.supportedOperations,
      endpoints: m.endpoints,
    }));

    // Include the user's custom default model if not already in the list
    if (this.defaultModel && !models.find((m) => m.id === this.defaultModel)) {
      models.unshift({
        id: this.defaultModel,
        name: this.defaultModel,
        supportedOperations: ['text-to-image', 'image-to-image', 'multi-reference'],
        endpoints: {
          'text-to-image': 'chat/completions',
          'image-to-image': 'chat/completions',
          'multi-reference': 'chat/completions',
        },
      });
    }

    return models;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    const modelId = request.model || this.defaultModel;
    const modelDef = OPENROUTER_MODELS.find((m) => m.id === modelId);

    // Known models enforce operation support; unknown models are allowed for all operations
    if (modelDef && !modelDef.supportedOperations.includes(request.operation)) {
      throw new ImageEngineError(
        `Model "${modelId}" does not support operation "${request.operation}"`,
        this.id
      );
    }

    let result;
    try {
      result = await this.client.generateImage(
        {
          model: modelId,
          messages: this.buildMessages(request),
          n: request.numImages ?? 1,
          imageConfig: {
            aspect_ratio: this.computeAspectRatio(request.width, request.height),
          },
        },
        request.signal,
      );
    } catch (error) {
      if (error instanceof OpenRouterHttpError) {
        throw new ImageEngineError(error.message, this.id, error.statusCode, error.cause);
      }
      throw error;
    }

    const images = this.mapImages(result.images, request.width, request.height);

    return {
      images,
      model: modelId,
      provider: this.id,
      durationMs: Date.now() - start,
    };
  }

  private buildMessages(request: ImageGenerationRequest): OpenRouterChatMessage[] {
    if (request.operation === 'text-to-image') {
      return [{ role: 'user', content: request.prompt }];
    }

    // For image-to-image and multi-reference, build multipart content
    const parts: OpenRouterContentPart[] = [];

    if (request.operation === 'image-to-image' && request.sourceImage) {
      parts.push({
        type: 'image_url',
        image_url: { url: this.toDataUri(request.sourceImage) },
      });
    } else if (request.operation === 'multi-reference' && request.referenceImages) {
      for (const img of request.referenceImages) {
        parts.push({
          type: 'image_url',
          image_url: { url: this.toDataUri(img) },
        });
      }
    }

    parts.push({ type: 'text', text: request.prompt });

    return [{ role: 'user', content: parts }];
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

  private mapImages(
    entries: Array<{ dataUri: string }>,
    requestedWidth?: number,
    requestedHeight?: number
  ): GeneratedImage[] {
    const width = requestedWidth ?? 1024;
    const height = requestedHeight ?? 1024;

    const images: GeneratedImage[] = entries.map((entry) => ({
      base64: this.stripDataUri(entry.dataUri),
      width,
      height,
      contentType: this.extractContentType(entry.dataUri),
    }));

    if (images.length === 0) {
      throw new ImageEngineError(
        'No images returned in OpenRouter response',
        this.id
      );
    }

    return images;
  }

  private stripDataUri(url: string): string {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : url;
  }

  private extractContentType(url: string): string {
    const match = url.match(/^data:([^;]+);base64,/);
    return match ? match[1] : 'image/png';
  }
}
