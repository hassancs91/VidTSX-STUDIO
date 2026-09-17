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
import { jpegDimensions } from './gemini-cli-provider';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('CodexCliProvider');

/** Probe result for the Codex CLI, cached by the main-process service. */
export interface CodexCliStatus {
  installed: boolean;
  authenticated: boolean;
  binaryPath: string;
  /** `codex --version` ("codex-cli 0.154.0") — a Codex update can change any of the protocol. */
  version?: string;
  /** Short human-readable failure detail (probe stderr, exit code). */
  detail?: string;
  probedAt: number;
}

/** One of the three sizes GPT Image 2 renders through Codex (docs/ai-models-redesign.md §3.7). */
export interface CodexImageSize {
  width: number;
  height: number;
  label: string;
}

export const CODEX_IMAGE_SIZES: readonly CodexImageSize[] = [
  { width: 1024, height: 1024, label: '1024x1024 (square)' },
  { width: 1536, height: 1024, label: '1536x1024 (landscape)' },
  { width: 1024, height: 1536, label: '1024x1536 (portrait)' },
];

/** Reference images per run; the spike attached one, the same cap as the Antigravity tool keeps runs bounded. */
export const CODEX_MAX_REFERENCE_IMAGES = 3;

export interface CodexGenerateRequest {
  prompt: string;
  size: CodexImageSize;
  /** Absolute paths to reference images, in order. */
  referencePaths?: string[];
  signal?: AbortSignal;
}

export interface CodexUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface CodexGenerateResult {
  image: Buffer;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  threadId: string;
  usage?: CodexUsage;
}

/**
 * The main-process Codex service, injected at registration so this module
 * stays free of main-process imports (the Antigravity provider's precedent).
 * Implemented by `src/main/services/codex-cli.ts`.
 */
export interface CodexCliBridge {
  getCachedStatus(): CodexCliStatus | null;
  ensureProbed(): Promise<CodexCliStatus>;
  generateImage(request: CodexGenerateRequest): Promise<CodexGenerateResult>;
}

/** The request is an aspect, not a pixel size (the spike returned 1254² for 1024²): pick the nearest of the three. */
export function nearestCodexSize(width?: number, height?: number): CodexImageSize {
  if (!width || !height) return CODEX_IMAGE_SIZES[0];
  const ratio = width / height;
  let best = CODEX_IMAGE_SIZES[0];
  let bestDistance = Infinity;
  for (const candidate of CODEX_IMAGE_SIZES) {
    const distance = Math.abs(Math.log(ratio / (candidate.width / candidate.height)));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Width and height from a PNG's IHDR chunk. */
export function pngDimensions(data: Buffer): { width: number; height: number } | null {
  if (data.length < 24 || data.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function rawBase64(data: string): string {
  const comma = data.indexOf(',');
  return data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
}

function refExtension(base64: string): string {
  if (base64.startsWith('/9j/')) return '.jpg';
  if (base64.startsWith('UklGR')) return '.webp';
  return '.png';
}

function measure(result: CodexGenerateResult, fallback: { width: number; height: number }): { width: number; height: number } {
  return (
    (result.contentType === 'image/png' ? pngDimensions(result.image) : jpegDimensions(result.image)) ?? fallback
  );
}

/**
 * Bridges the OpenAI Codex CLI (`codex exec`) into the image engine, so
 * generation bills the user's ChatGPT plan (GPT Image 2) instead of a metered
 * key — docs/ai-models-redesign.md §3.7. A CLI-bridge provider like the
 * Antigravity one: registered as an instance, never stored in provider
 * settings, zero models while the CLI is missing or signed out (the UI then
 * hides it). Content Safety: nothing here — every generation flows through
 * the engine's fail-closed runGuarded chokepoint like any other provider.
 */
export class CodexCliImageProvider implements ImageProvider {
  readonly id: string;
  /** The single subscription model; keys the per-model params override. */
  readonly defaultModel = 'gpt-image-2';

  private readonly cli: CodexCliBridge;

  constructor(id: string, cli: CodexCliBridge) {
    this.id = id;
    this.cli = cli;
  }

  getSupportedModels(): ImageModelInfo[] {
    const status = this.cli.getCachedStatus();
    if (!status?.installed || !status.authenticated) return [];
    return [
      {
        id: 'gpt-image-2',
        name: 'GPT Image 2 (subscription)',
        supportedOperations: ['text-to-image', 'multi-reference'],
        endpoints: {},
        paramSchema: IMAGE_DIALECT_DEFAULTS['codex-cli'].paramSchema,
      },
    ];
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const status = await this.cli.ensureProbed();
    if (!status.installed) {
      throw new ImageEngineError(
        'The Codex CLI is not installed. Set it up in AI Models → Providers → Subscriptions first.',
        this.id,
      );
    }
    if (!status.authenticated) {
      throw new ImageEngineError(
        'The Codex CLI is installed but not signed in. Run "codex login" in a terminal with the account that holds your ChatGPT plan, then try again.',
        this.id,
      );
    }
    if (request.operation === 'image-to-image') {
      throw new ImageEngineError(
        'GPT Image 2 through Codex does not take a source image here — attach it as a reference image instead.',
        this.id,
      );
    }

    const refs = request.referenceImages ?? [];
    if (refs.length > CODEX_MAX_REFERENCE_IMAGES) {
      throw new ImageEngineError(
        `GPT Image 2 accepts at most ${CODEX_MAX_REFERENCE_IMAGES} reference images here — fold the extra subjects into the prompt text instead.`,
        this.id,
      );
    }
    if (request.operation === 'multi-reference' && refs.length === 0) {
      throw new ImageEngineError('Reference-image generation needs at least one reference image.', this.id);
    }

    // Codex takes reference images as file paths (-i) — stage the base64 inputs.
    const referencePaths: string[] = [];
    let tempDir: string | undefined;
    if (refs.length > 0) {
      tempDir = path.join(os.tmpdir(), 'vidtsx-codex', randomUUID());
      await fs.mkdir(tempDir, { recursive: true });
      for (let i = 0; i < refs.length; i++) {
        const raw = rawBase64(refs[i]);
        const refPath = path.join(tempDir, `ref-${i + 1}${refExtension(raw)}`);
        await fs.writeFile(refPath, Buffer.from(raw, 'base64'));
        referencePaths.push(refPath);
      }
    }

    const size = nearestCodexSize(request.width, request.height);
    const numImages = Math.max(1, request.numImages ?? 1);
    const images: GeneratedImage[] = [];
    const startTime = Date.now();

    try {
      // Sequential on purpose: each call is a whole agent turn on the plan,
      // and the service serializes to concurrency 1 anyway.
      for (let i = 0; i < numImages; i++) {
        if (request.signal?.aborted) {
          throw new ImageEngineError('Image generation cancelled', this.id);
        }
        const result = await this.cli.generateImage({
          prompt: request.prompt,
          size,
          referencePaths: referencePaths.length > 0 ? referencePaths : undefined,
          signal: request.signal,
        });
        const dims = measure(result, { width: size.width, height: size.height });
        images.push({
          base64: result.image.toString('base64'),
          width: dims.width,
          height: dims.height,
          contentType: result.contentType,
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
      model: 'gpt-image-2',
      provider: this.id,
      durationMs: Date.now() - startTime,
    };
  }
}
