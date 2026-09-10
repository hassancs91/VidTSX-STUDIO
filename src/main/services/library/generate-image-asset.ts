// generate_image behind the agent tool (D12 / L5): wraps the shared
// imageEngine and files the result as BORN-MANAGED library content —
// `generated/` (or a given folder), origin 'generated', the prompt as the
// initial description, auto-tagged with the active brand. Additive: no
// proposal — the shot proposal that uses the image is where it gets judged.

import fs from 'fs/promises';
import { imageEngine } from '../../../image-engine';
import type { ImageOperation } from '../../../image-engine/types';
import { aiUsageService } from '../ai-usage';
import { getDefaultImageModelPriceUsd } from '../../../shared/presets/provider-model-defaults';
import { ensureLibraryRoot } from './library-paths';
import { upsertEntry } from './library-store';
import { readBrand } from './brand-store';
import { GENERATED_FOLDER, reserveLibraryFile, sanitizeFolder, slugify } from './library-filing';
import type { AiFeatureSource } from '../../../shared/types/ai-usage';

export type ImageAspect = 'square' | 'landscape' | 'portrait';

/** Modest 64-multiples every provider handles; the engine may clamp further. */
const ASPECT_SIZES: Record<ImageAspect, { width: number; height: number }> = {
  square: { width: 1024, height: 1024 },
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
};

export interface GenerateImageAssetRequest {
  prompt: string;
  /** Library folder; defaults to `generated/`. */
  folder?: string;
  aspect?: ImageAspect;
  /** Brand to auto-tag (the project's active brand). Stale ids degrade to
   *  untagged — the image is still made. */
  brandId?: string;
  signal?: AbortSignal;
  /** Usage attribution. Defaults to Studio's shot asset, its first caller. */
  featureSource?: AiFeatureSource;
  /** `<namespace>/<name>` when an agent asked for it (agents plan §9). */
  agentId?: string;
  /** Flows (W8 Stage 1): a provider other than the active one, and a model
   *  on it. Absent = the active provider and its default model. */
  providerId?: string;
  model?: string;
  /** An explicit size wins over `aspect`. */
  width?: number;
  height?: number;
  /** Base64 inputs. One source = image-to-image; references = multi-
   *  reference. The engine's Gate B checks them before any provider call. */
  sourceImage?: string;
  referenceImages?: string[];
}

export interface GeneratedImageAsset {
  relPath: string;
  width: number;
  height: number;
  description: string;
  brandId?: string;
}

export async function generateImageAsset(
  req: GenerateImageAssetRequest,
): Promise<GeneratedImageAsset> {
  if (!imageEngine.getActiveProvider()) {
    throw new Error(
      'No image provider is configured — ask the user to set one up in Settings → AI Providers → Image.',
    );
  }
  if (req.providerId && !imageEngine.getProviders().includes(req.providerId)) {
    throw new Error(
      `Image provider "${req.providerId}" is not configured — add its key in AI → Providers or pick another.`,
    );
  }
  const preset = ASPECT_SIZES[req.aspect ?? 'landscape'];
  const size = {
    width: req.width && req.width > 0 ? req.width : preset.width,
    height: req.height && req.height > 0 ? req.height : preset.height,
  };
  const references = req.referenceImages?.filter((r) => r.length > 0) ?? [];
  const operation: ImageOperation =
    references.length > 0 ? 'multi-reference' : req.sourceImage ? 'image-to-image' : 'text-to-image';
  const request = {
    operation,
    prompt: req.prompt,
    width: size.width,
    height: size.height,
    numImages: 1,
    outputFormat: 'png' as const,
    ...(req.model ? { model: req.model } : {}),
    ...(operation === 'image-to-image' && req.sourceImage ? { sourceImage: req.sourceImage } : {}),
    ...(operation === 'multi-reference' ? { referenceImages: references } : {}),
    ...(req.signal ? { signal: req.signal } : {}),
  };
  const result = req.providerId
    ? await imageEngine.generateWith(req.providerId, request)
    : await imageEngine.generate(request);
  const image = result.images[0];
  if (!image?.base64) throw new Error('The image provider returned no image');

  // Cost = the shipped catalog's per-image estimate (the same lookup the
  // Image Studio IPC uses); unknown models and the local bridge stay $0.
  const usageProvider = req.providerId ?? imageEngine.getActiveProvider() ?? 'unknown';
  const usageModel = result.model || 'unknown';
  aiUsageService
    .appendEntry({
      timestamp: new Date().toISOString(),
      provider: usageProvider,
      model: usageModel,
      featureSource: req.featureSource ?? 'studio-shot-asset',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: getDefaultImageModelPriceUsd(usageProvider, usageModel) * result.images.length,
      durationMs: result.durationMs ?? 0,
      requestType: 'image',
      ...(req.agentId ? { agentId: req.agentId } : {}),
    })
    .catch(() => {});

  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(req.folder, GENERATED_FOLDER);
  const { relPath, absPath } = await reserveLibraryFile(root, folder, slugify(req.prompt), '.png');
  await fs.writeFile(absPath, Buffer.from(image.base64, 'base64'));

  // Auto-tag only a brand that still exists — a stale default never plants
  // a dangling tag.
  const brand = req.brandId ? await readBrand(root, req.brandId) : null;
  const description = req.prompt.trim();
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description,
    ...(brand ? { brandId: brand.id } : {}),
  });

  return {
    relPath,
    width: image.width || size.width,
    height: image.height || size.height,
    description,
    ...(brand ? { brandId: brand.id } : {}),
  };
}
