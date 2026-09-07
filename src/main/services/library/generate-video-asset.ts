// generate_video behind the agent tool (video-providers plan §2.5 / D7):
// wraps the shared videoEngine's awaiting form and files the gated clip as
// BORN-MANAGED library content — `generated/` (or a given folder), origin
// 'generated', the prompt as the initial description, auto-tagged with the
// active brand. The clip also lives in Video Studio (the engine files it
// there first); this copies it into the library so both galleries show it.

import fs from 'fs/promises';
import path from 'path';
import { videoEngine } from '../../../video-engine';
import type { MediaInput, VideoJobListener } from '../../../video-engine';
import type { VideoResolution } from '../../../shared/presets/video-models';
import type { AiFeatureSource } from '../../../shared/types/ai-usage';
import { ensureLibraryRoot } from './library-paths';
import { upsertEntry } from './library-store';
import { readBrand } from './brand-store';
import { GENERATED_FOLDER, reserveLibraryFile, sanitizeFolder, slugify } from './library-filing';

export interface GenerateVideoAssetRequest {
  prompt: string;
  /** Video provider id; defaults to the engine's active provider. */
  providerId?: string;
  /** Catalog model id; defaults to the active provider's default model. */
  model?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  /** The engine clamps to the model's own list, and the job is billed at that
   *  resolution's published rate. */
  resolution?: VideoResolution;
  generateAudio?: boolean;
  firstFrame?: MediaInput;
  lastFrame?: MediaInput;
  /** Library folder; defaults to `generated/`. */
  folder?: string;
  /** Brand to auto-tag (the project's active brand). Stale ids degrade to
   *  untagged — the clip is still made. */
  brandId?: string;
  /** Who asked: Studio's own shot assets by default, `'agent'` for the
   *  `generate_video` tool. Only affects the usage log's attribution. */
  featureSource?: AiFeatureSource;
  onProgress?: VideoJobListener;
  signal?: AbortSignal;
}

export interface GeneratedVideoAsset {
  relPath: string;
  /** Video Studio entry id (the clip's other home). */
  entryId: string;
  durationSeconds: number;
  aspectRatio: string;
  hasAudio: boolean;
  description: string;
  brandId?: string;
}

export async function generateVideoAsset(
  req: GenerateVideoAssetRequest,
): Promise<GeneratedVideoAsset> {
  if (!videoEngine.getActiveProvider()) {
    throw new Error(
      'No video provider is configured — ask the user to add a Fal or BytePlus ModelArk key in AI → Providers.',
    );
  }
  const model = req.model ?? videoEngine.getModels(req.providerId)[0]?.id ?? '';
  const result = await videoEngine.generateAndWait(
    {
      model,
      prompt: req.prompt,
      ...(req.providerId ? { providerId: req.providerId } : {}),
      ...(req.durationSeconds !== undefined ? { durationSeconds: req.durationSeconds } : {}),
      ...(req.aspectRatio ? { aspectRatio: req.aspectRatio } : {}),
      ...(req.resolution ? { resolution: req.resolution } : {}),
      ...(req.generateAudio !== undefined ? { generateAudio: req.generateAudio } : {}),
      ...(req.firstFrame ? { firstFrame: req.firstFrame } : {}),
      ...(req.lastFrame ? { lastFrame: req.lastFrame } : {}),
      featureSource: req.featureSource ?? 'studio-shot-asset',
      ...(req.signal ? { signal: req.signal } : {}),
    },
    { ...(req.onProgress ? { onProgress: req.onProgress } : {}) },
  );

  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(req.folder, GENERATED_FOLDER);
  const ext = path.extname(result.entry.fileName) || '.mp4';
  const { relPath, absPath } = await reserveLibraryFile(root, folder, slugify(req.prompt), ext);
  await fs.copyFile(result.filePath, absPath);

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
    entryId: result.entry.id,
    durationSeconds: result.durationSeconds,
    aspectRatio: result.aspectRatio,
    hasAudio: result.hasAudio,
    description,
    ...(brand ? { brandId: brand.id } : {}),
  };
}
