// generate_image behind the agent tool (D12 / L5): wraps the shared
// imageEngine and files the result as BORN-MANAGED library content —
// `generated/` (or a given folder), origin 'generated', the prompt as the
// initial description, auto-tagged with the active brand. Additive: no
// proposal — the shot proposal that uses the image is where it gets judged.

import fs from 'fs/promises';
import { imageEngine } from '../../../image-engine';
import { aiUsageService } from '../ai-usage';
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
  const size = ASPECT_SIZES[req.aspect ?? 'landscape'];
  const result = await imageEngine.generate({
    operation: 'text-to-image',
    prompt: req.prompt,
    width: size.width,
    height: size.height,
    numImages: 1,
    outputFormat: 'png',
    ...(req.signal ? { signal: req.signal } : {}),
  });
  const image = result.images[0];
  if (!image?.base64) throw new Error('The image provider returned no image');

  aiUsageService
    .appendEntry({
      timestamp: new Date().toISOString(),
      provider: imageEngine.getActiveProvider() ?? 'unknown',
      model: result.model || 'unknown',
      featureSource: req.featureSource ?? 'studio-shot-asset',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
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
