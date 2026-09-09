import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import { BytePlusArkClient, BytePlusHttpError } from '@shared/providers/byteplus';
import type {
  BytePlusCreateImageBody,
  BytePlusCreateImageResult,
  BytePlusImageData,
} from '@shared/providers/byteplus';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import { BYTEPLUS_IMAGE_MODELS } from '@shared/presets/image-model-entries';
import { IMAGE_DIALECT_DEFAULTS } from '@shared/presets/image-dialects';
import { schemaHasField } from '@shared/presets/image-model-params';

/**
 * What one ModelArk image model accepts beyond the shared dialect: the
 * total-pixel envelope of the `<width>x<height>` size form, its reference
 * cap, and the two features the 5.0 generations split on. Verified
 * 2026-09-10 against docs.byteplus.com/en/docs/ModelArk/1541523.
 */
export interface BytePlusImageModelDef {
  id: string;
  name: string;
  /** Inclusive total-pixel range (width × height) of an explicit size. */
  minPixels: number;
  maxPixels: number;
  /** Reference images the edit route takes (14 on 4.x / 5.0 lite, 10 on 5.0 pro). */
  maxReferences: number;
  /** `sequential_image_generation` accepted — 5.0 pro rejects the parameter. */
  sequential: boolean;
  /** `output_format` accepted (5.0 models); 4.x always emit jpeg. */
  outputFormat: boolean;
}

const MP_2560x1440 = 2560 * 1440; // 3 686 400
const MP_1280x720 = 1280 * 720; // 921 600
const MP_4096x4096 = 4096 * 4096; // 16 777 216
const MP_5_0_PRO_MAX = 4_624_220; // 2048 × 2048 × 1.1025

const KNOWN_BYTEPLUS_IMAGE_MODELS: readonly Omit<BytePlusImageModelDef, 'name'>[] = [
  { id: 'seedream-4-5-251128', minPixels: MP_2560x1440, maxPixels: MP_4096x4096, maxReferences: 14, sequential: true, outputFormat: false },
  { id: 'seedream-5-0-lite-260128', minPixels: MP_2560x1440, maxPixels: MP_4096x4096, maxReferences: 14, sequential: true, outputFormat: true },
  { id: 'seedream-5-0-260128', minPixels: MP_2560x1440, maxPixels: MP_4096x4096, maxReferences: 14, sequential: true, outputFormat: true },
  { id: 'dola-seedream-5-0-pro-260628', minPixels: MP_1280x720, maxPixels: MP_5_0_PRO_MAX, maxReferences: 10, sequential: false, outputFormat: true },
  { id: 'seedream-4-0-250828', minPixels: MP_1280x720, maxPixels: MP_4096x4096, maxReferences: 14, sequential: true, outputFormat: false },
];

/**
 * A user-added id gets the envelope EVERY listed model accepts (the 4.5 / 5.0
 * lite floor under the 5.0 pro ceiling), the pro's reference cap, and none
 * of the version-specific parameters — so an unknown Seedream id never gets
 * a body the API rejects for a field it does not know.
 */
function defFor(entry: ImageModelCatalogEntry): BytePlusImageModelDef {
  const known = KNOWN_BYTEPLUS_IMAGE_MODELS.find((m) => m.id === entry.id);
  const name = entry.name || entry.id;
  return known
    ? { ...known, name }
    : {
        id: entry.id,
        name,
        minPixels: MP_2560x1440,
        maxPixels: MP_5_0_PRO_MAX,
        maxReferences: 10,
        sequential: false,
        outputFormat: false,
      };
}

const DIALECT = IMAGE_DIALECT_DEFAULTS['byteplus-seedream'];
/** Every request names its size: the tier every model accepts when the caller gave none. */
const DEFAULT_TIER = '2K';
/** Input + output images of one request may not exceed 15 (sequential sets). */
const SET_TOTAL_CAP = 15;

/**
 * The `<width>x<height>` ModelArk will accept for a requested size: the
 * caller's aspect ratio, scaled into the model's total-pixel envelope on
 * multiples of 16 (the app asks for 1024² or 1280×720; Seedream 4.5 starts
 * at 2560×1440 worth of pixels). A size already inside the envelope goes
 * through untouched. Exposed for unit tests.
 */
export function fitBytePlusImageSize(
  def: Pick<BytePlusImageModelDef, 'minPixels' | 'maxPixels'>,
  width?: number,
  height?: number,
): string {
  if (!width || !height || width <= 0 || height <= 0) return DEFAULT_TIER;
  const pixels = width * height;
  if (pixels >= def.minPixels && pixels <= def.maxPixels) return `${width}x${height}`;
  const up = pixels < def.minPixels;
  const scale = Math.sqrt((up ? def.minPixels : def.maxPixels) / pixels);
  const snap = (v: number) => (up ? Math.ceil(v / 16) : Math.floor(v / 16)) * 16;
  return `${snap(width * scale)}x${snap(height * scale)}`;
}

function toDataUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${detectContentType(base64)};base64,${base64}`;
}

function detectContentType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

function parseSize(size: string | undefined): { width: number; height: number } | null {
  const m = size ? /^(\d+)x(\d+)$/.exec(size) : null;
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/**
 * BytePlus ModelArk provider: Seedream direct through the synchronous
 * `/images/generations` endpoint. The body is the `byteplus-seedream`
 * dialect (`seed` only when the caller set it — the API rejects
 * `guidance_scale`); sets ride `sequential_image_generation: 'auto'`
 * where the model takes it and fall back to one call per image where it
 * does not (5.0 pro). Images come back as base64, so nothing is downloaded.
 */
export class BytePlusImageProvider implements ImageProvider {
  private readonly client: BytePlusArkClient;
  private readonly models: BytePlusImageModelDef[];

  constructor(
    readonly id: string,
    apiKey: string,
    readonly defaultModel: string,
    catalog?: ImageModelCatalogEntry[],
    options: { baseUrl?: string } = {},
  ) {
    this.client = new BytePlusArkClient({
      apiKey,
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    });
    this.models = (catalog?.length ? catalog : BYTEPLUS_IMAGE_MODELS).map(defFor);
  }

  getSupportedModels(): ImageModelInfo[] {
    return this.models.map((m) => ({
      id: m.id,
      name: m.name,
      supportedOperations: [...DIALECT.supportedOperations],
      endpoints: {
        'text-to-image': m.id,
        'image-to-image': m.id,
        'multi-reference': m.id,
      },
      paramSchema: DIALECT.paramSchema,
    }));
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const start = Date.now();
    const modelId = request.model || this.defaultModel;
    const def = this.models.find((m) => m.id === modelId);
    if (!def) {
      throw new ImageEngineError(
        `Unknown model "${modelId}". Available: ${this.models.map((m) => m.id).join(', ')}`,
        this.id,
      );
    }

    const numImages = Math.max(1, request.numImages ?? 1);
    // One request for a sequential set; N single requests where the model
    // has no set mode (the count is then exact rather than model-decided).
    const calls = def.sequential ? 1 : numImages;
    const images: GeneratedImage[] = [];
    try {
      for (let i = 0; i < calls; i++) {
        const body = this.buildRequestBody(def, request);
        const result = await this.client.createImage(body, request.signal);
        images.push(...this.collectImages(result, body, request));
      }
    } catch (error) {
      if (error instanceof BytePlusHttpError) {
        throw new ImageEngineError(error.message, this.id, error.statusCode, error.cause ?? error);
      }
      throw error;
    }

    return { images, model: modelId, provider: this.id, durationMs: Date.now() - start };
  }

  /**
   * Body per the dialect and the model's own envelope. Exposed for unit
   * tests, which is how the wire shape is pinned.
   */
  buildRequestBody(def: BytePlusImageModelDef, request: ImageGenerationRequest): BytePlusCreateImageBody {
    const body: BytePlusCreateImageBody = {
      model: def.id,
      prompt: request.prompt,
      size: fitBytePlusImageSize(def, request.width, request.height),
      response_format: 'b64_json',
      watermark: false,
    };

    const p = request.params ?? {};
    if (p.seed !== undefined && schemaHasField(DIALECT.paramSchema, 'seed')) {
      body.seed = Math.round(p.seed);
    }
    if (def.outputFormat && (request.outputFormat === 'png' || request.outputFormat === 'jpeg')) {
      body.output_format = request.outputFormat;
    }

    let inputs = 0;
    if (request.operation === 'image-to-image' && request.sourceImage) {
      body.image = toDataUri(request.sourceImage);
      inputs = 1;
    } else if (request.operation === 'multi-reference' && request.referenceImages?.length) {
      if (request.referenceImages.length > def.maxReferences) {
        throw new ImageEngineError(
          `${def.name} takes at most ${def.maxReferences} reference images (${request.referenceImages.length} given).`,
          this.id,
        );
      }
      body.image = request.referenceImages.map(toDataUri);
      inputs = request.referenceImages.length;
    }

    if (def.sequential) {
      const wanted = Math.max(1, request.numImages ?? 1);
      if (wanted > 1) {
        body.sequential_image_generation = 'auto';
        body.sequential_image_generation_options = {
          max_images: Math.max(1, Math.min(wanted, SET_TOTAL_CAP - inputs)),
        };
      } else {
        body.sequential_image_generation = 'disabled';
      }
    }
    return body;
  }

  private collectImages(
    result: BytePlusCreateImageResult,
    body: BytePlusCreateImageBody,
    request: ImageGenerationRequest,
  ): GeneratedImage[] {
    const items = result.data ?? [];
    const ok = items.filter((d): d is BytePlusImageData & { b64_json: string } => !!d.b64_json);
    if (ok.length === 0) {
      const failed = items.find((d) => d.error)?.error ?? result.error;
      throw new ImageEngineError(failed?.message ?? 'ModelArk returned no image', this.id, undefined, failed);
    }
    const fallback = parseSize(body.size) ?? {
      width: request.width ?? 1024,
      height: request.height ?? 1024,
    };
    return ok.map((d) => {
      const size = parseSize(d.size) ?? fallback;
      const contentType = d.output_format ? `image/${d.output_format}` : detectContentType(d.b64_json);
      return { base64: d.b64_json, width: size.width, height: size.height, contentType };
    });
  }
}
