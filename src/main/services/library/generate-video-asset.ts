// Video generation as LIBRARY content, in two steps (agents plan §1.5).
//
// The engine's own filing only reaches Video Studio. Getting a clip into the
// Asset Library as BORN-MANAGED content — `generated/` (or a given folder),
// origin 'generated', the prompt as the initial description, auto-tagged with
// the active brand — happens here, AFTER the job finishes.
//
// It is deliberately two exports rather than one awaiting call:
//
//   submitVideoAsset(req)      → a VideoJobRecord, at once. No wait, no spend
//                                past the submit, `ctx.signal` still cancels.
//   fileVideoAsset(record, o)  → copies the gated clip into the library.
//
// The second step keys off the TERMINAL `VideoJobRecord`, never off a
// subscription event, and is IDEMPOTENT: the library file name is derived from
// the job id, so filing the same job twice is a no-op rather than a duplicate.
// That is what lets a session re-drive filing on open for any terminal job that
// never got filed — otherwise the user has paid for a clip that reached Video
// Studio and no further.

import fs from 'fs/promises';
import path from 'path';
import { videoEngine } from '../../../video-engine';
import type { MediaInput, VideoJobRecord } from '../../../video-engine';
import type { VideoResolution } from '../../../shared/presets/video-models';
import type { AiFeatureSource } from '../../../shared/types/ai-usage';
import { ensureLibraryRoot, resolveLibraryPath } from './library-paths';
import { upsertEntry } from './library-store';
import { readBrand } from './brand-store';
import { GENERATED_FOLDER, sanitizeFolder, slugify } from './library-filing';

export interface SubmitVideoAssetRequest {
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
  /** Who asked: Studio's own shot assets by default, `'agent'` for the
   *  `generate_video` tool. Only affects the usage log's attribution. */
  featureSource?: AiFeatureSource;
  /** `<namespace>/<name>` when an agent asked for it (agents plan §9). */
  agentId?: string;
  /** Cancels the submit AND the provider job — a cancelled run stops paying. */
  signal?: AbortSignal;
}

/** Where the clip is filed, and under whose brand. Not on the job record, so
 *  a re-drive supplies them from the session that submitted. */
export interface FileVideoAssetOptions {
  /** Library folder; defaults to `generated/`. */
  folder?: string;
  /** Brand to auto-tag. Stale ids degrade to untagged — the clip still files. */
  brandId?: string;
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
  /** False when the file was already there — a re-drive that found its work
   *  done. Callers use it only for logging; the descriptor is the same. */
  filed: boolean;
}

/** Enough of the job id to make the name unique inside one folder. */
const JOB_SUFFIX_CHARS = 12;

export async function submitVideoAsset(req: SubmitVideoAssetRequest): Promise<VideoJobRecord> {
  if (!videoEngine.getActiveProvider()) {
    throw new Error(
      'No video provider is configured — ask the user to add a Fal or BytePlus ModelArk key in AI → Providers.',
    );
  }
  const model = req.model ?? videoEngine.getModels(req.providerId)[0]?.id ?? '';
  return videoEngine.submit({
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
    ...(req.agentId ? { agentId: req.agentId } : {}),
    ...(req.signal ? { signal: req.signal } : {}),
  });
}

/**
 * Copy a COMPLETED job's gated clip into the Asset Library and register it.
 * Safe to call any number of times for the same job.
 *
 * Throws when the record is not a completed job with a result — callers check
 * the status themselves and report failure their own way.
 */
export async function fileVideoAsset(
  record: VideoJobRecord,
  options: FileVideoAssetOptions = {},
): Promise<GeneratedVideoAsset> {
  if (record.status !== 'completed' || !record.result) {
    throw new Error(
      `Video job ${record.jobId} is "${record.status}", so there is nothing to file yet.`,
    );
  }
  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(options.folder, GENERATED_FOLDER);
  const ext = path.extname(record.result.entry.fileName) || '.mp4';
  // Derived from the job id, NOT reserved: two calls for one job must resolve
  // to the same path, which is the whole of the idempotency.
  const base = `${slugify(record.request.prompt)}-${record.jobId.replace(/-/g, '').slice(0, JOB_SUFFIX_CHARS)}`;
  const relPath = `${folder}/${base}${ext}`;
  const absPath = resolveLibraryPath(root, relPath);

  let filed = false;
  try {
    await fs.access(absPath);
  } catch {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.copyFile(record.result.filePath, absPath);
    filed = true;
  }

  // Auto-tag only a brand that still exists — a stale default never plants
  // a dangling tag.
  const brand = options.brandId ? await readBrand(root, options.brandId) : null;
  const description = record.request.prompt.trim();
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description,
    ...(brand ? { brandId: brand.id } : {}),
  });

  return {
    relPath,
    entryId: record.result.entry.id,
    durationSeconds: record.request.durationSeconds,
    aspectRatio: record.request.aspectRatio,
    hasAudio: record.request.generateAudio,
    description,
    ...(brand ? { brandId: brand.id } : {}),
    filed,
  };
}
