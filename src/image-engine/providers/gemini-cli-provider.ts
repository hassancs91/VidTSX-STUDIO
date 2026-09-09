import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelInfo,
  GeneratedImage,
} from '../types';
import { ImageEngineError } from '../types';
import { IMAGE_DIALECT_DEFAULTS } from '@shared/presets/image-dialects';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('GeminiCliProvider');

/**
 * Probe result for the Antigravity CLI. Cached by the main-process service;
 * the provider reads the cache synchronously in getSupportedModels().
 */
export interface AgyCliStatus {
  installed: boolean;
  authenticated: boolean;
  binaryPath: string;
  /** Short human-readable failure detail (probe stderr, exit code). */
  detail?: string;
  probedAt: number;
}

export interface AgyGenerateRequest {
  prompt: string;
  /** One of the aspect ratios agy accepts (see AGY_ASPECT_RATIOS). */
  aspect: string;
  /** Absolute paths to reference images, max 3, order matters. */
  referencePaths?: string[];
  signal?: AbortSignal;
}

export interface AgyGenerateResult {
  /** The generated image bytes (always JPEG, whatever the harvest extension). */
  image: Buffer;
  conversationId: string;
}

/**
 * The main-process agy service, injected at registration so this module stays
 * free of main-process imports (the LocalSdImageProvider prepare-hook
 * precedent). Implemented by `src/main/services/agy-cli.ts`.
 */
export interface AgyCliBridge {
  getCachedStatus(): AgyCliStatus | null;
  ensureProbed(): Promise<AgyCliStatus>;
  generateImage(request: AgyGenerateRequest): Promise<AgyGenerateResult>;
}

/** The aspect set the generate_image tool accepts (verified, not guessed). */
const AGY_ASPECT_RATIOS: Array<{ aspect: string; ratio: number }> = [
  { aspect: '1:1', ratio: 1 },
  { aspect: '2:3', ratio: 2 / 3 },
  { aspect: '3:2', ratio: 3 / 2 },
  { aspect: '3:4', ratio: 3 / 4 },
  { aspect: '4:3', ratio: 4 / 3 },
  { aspect: '4:5', ratio: 4 / 5 },
  { aspect: '9:16', ratio: 9 / 16 },
  { aspect: '16:9', ratio: 16 / 9 },
];

/** Bucket requested pixel dimensions to the nearest aspect agy supports. */
export function nearestAgyAspect(width?: number, height?: number): string {
  if (!width || !height) return '1:1';
  const ratio = width / height;
  let best = AGY_ASPECT_RATIOS[0];
  let bestDistance = Infinity;
  for (const candidate of AGY_ASPECT_RATIOS) {
    const distance = Math.abs(Math.log(ratio / candidate.ratio));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.aspect;
}

/**
 * Read actual pixel dimensions from a JPEG's SOF marker. agy picks output
 * resolution itself (no width/height parameters exist), so the request dims
 * are only a fallback when parsing fails.
 */
export function jpegDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1];
    // Standalone markers without a length payload.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = data.readUInt16BE(offset + 2);
    // SOF0–SOF15, excluding DHT (C4), JPG (C8), DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

/** Strip an optional data-URI prefix, leaving raw base64. */
function rawBase64(data: string): string {
  const comma = data.indexOf(',');
  return data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
}

function refExtension(base64: string): string {
  if (base64.startsWith('/9j/')) return '.jpg';
  if (base64.startsWith('UklGR')) return '.webp';
  return '.png';
}

/**
 * Bridges the Antigravity CLI (`agy`) into the image engine, so generation
 * bills the user's Google AI Pro/Ultra subscription (Nano Banana 2) instead
 * of a metered API key. CLI-bridge provider like LocalSdImageProvider:
 * registered as an instance, never stored in provider settings, reports zero
 * models while the CLI is missing or signed out (the UI then hides it).
 *
 * Content Safety: nothing here — every generation flows through the engine's
 * fail-closed runGuarded chokepoint like any other provider.
 */
export class GeminiCliImageProvider implements ImageProvider {
  readonly id: string;
  /** The single subscription model; keys the per-model params override. */
  readonly defaultModel = 'nano-banana-2';

  private readonly cli: AgyCliBridge;

  constructor(id: string, cli: AgyCliBridge) {
    this.id = id;
    this.cli = cli;
  }

  getSupportedModels(): ImageModelInfo[] {
    const status = this.cli.getCachedStatus();
    if (!status?.installed || !status.authenticated) return [];
    return [
      {
        id: 'nano-banana-2',
        name: 'Nano Banana 2 (subscription)',
        supportedOperations: ['text-to-image', 'multi-reference'],
        endpoints: {},
        paramSchema: IMAGE_DIALECT_DEFAULTS['gemini-cli'].paramSchema,
      },
    ];
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const status = await this.cli.ensureProbed();
    if (!status.installed) {
      throw new ImageEngineError(
        'The Antigravity CLI (agy) is not installed. Set it up in AI Models → Image first.',
        this.id,
      );
    }
    if (!status.authenticated) {
      throw new ImageEngineError(
        'The Antigravity CLI is installed but not signed in. Run "agy" in a terminal, sign in with your Google account, then try again.',
        this.id,
      );
    }
    if (request.operation === 'image-to-image') {
      throw new ImageEngineError(
        'Nano Banana 2 does not support image-to-image here — attach the source as a reference image instead.',
        this.id,
      );
    }

    const refs = request.referenceImages ?? [];
    if (refs.length > 3) {
      // The tool rejects a 4th path outright ("cannot provide more than 3 image paths").
      throw new ImageEngineError(
        'Nano Banana 2 accepts at most 3 reference images — fold the extra subjects into the prompt text instead.',
        this.id,
      );
    }
    if (request.operation === 'multi-reference' && refs.length === 0) {
      throw new ImageEngineError('Reference-image generation needs at least one reference image.', this.id);
    }

    // agy takes reference images as file paths — stage the base64 inputs.
    const referencePaths: string[] = [];
    let tempDir: string | undefined;
    if (refs.length > 0) {
      tempDir = path.join(os.tmpdir(), 'vidtsx-agy', randomUUID());
      await fs.mkdir(tempDir, { recursive: true });
      for (let i = 0; i < refs.length; i++) {
        const raw = rawBase64(refs[i]);
        const refPath = path.join(tempDir, `ref-${i + 1}${refExtension(raw)}`);
        await fs.writeFile(refPath, Buffer.from(raw, 'base64'));
        referencePaths.push(refPath);
      }
    }

    const aspect = nearestAgyAspect(request.width, request.height);
    const numImages = Math.max(1, request.numImages ?? 1);
    const images: GeneratedImage[] = [];
    const startTime = Date.now();

    try {
      // Sequential on purpose: each call spawns a whole agent, and the service
      // serializes to concurrency 1 anyway. No seed exists, so images differ.
      for (let i = 0; i < numImages; i++) {
        if (request.signal?.aborted) {
          throw new ImageEngineError('Image generation cancelled', this.id);
        }
        const result = await this.cli.generateImage({
          prompt: request.prompt,
          aspect,
          referencePaths: referencePaths.length > 0 ? referencePaths : undefined,
          signal: request.signal,
        });
        const dims = jpegDimensions(result.image) ?? {
          width: request.width ?? 1024,
          height: request.height ?? 1024,
        };
        images.push({
          base64: result.image.toString('base64'),
          width: dims.width,
          height: dims.height,
          // Output is always JPEG bytes, whatever outputFormat asked for.
          contentType: 'image/jpeg',
        });
      }
    } catch (err) {
      if (err instanceof ImageEngineError) throw err;
      const message = err instanceof Error ? err.message : 'Subscription image generation failed';
      log.warn('Generation failed', { error: message });
      throw new ImageEngineError(message, this.id, undefined, err);
    } finally {
      if (tempDir) {
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    return {
      images,
      model: 'nano-banana-2',
      provider: this.id,
      durationMs: Date.now() - startTime,
    };
  }
}
