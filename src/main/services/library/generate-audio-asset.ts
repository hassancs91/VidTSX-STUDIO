// Sound effects and music as LIBRARY content (V1 completion plan §2.2 W2b) —
// the audio mirror of generate-video-asset.ts, in the one-call form of
// generate-image-asset.ts because the provider answers synchronously: the
// engine returns bytes, and this files them as BORN-MANAGED content —
// `generated/` (or a given folder), origin 'generated', the prompt as the
// initial description, auto-tagged with the brand. Usage is logged by the
// engine's sink (audio-generation-init.ts), never here.

import fs from 'fs/promises';
import { audioGenerationEngine } from '../../../audio-engine/generation';
import type {
  AudioCompositionPlan,
  AudioGenerationKind,
  AudioOutputFormat,
} from '../../../audio-engine/generation';
import type { AiFeatureSource } from '../../../shared/types/ai-usage';
import { ensureAudioGenerationEngine } from '../audio-generation-init';
import { ensureLibraryRoot } from './library-paths';
import { upsertEntry } from './library-store';
import { readBrand } from './brand-store';
import { GENERATED_FOLDER, reserveLibraryFile, sanitizeFolder, slugify } from './library-filing';

/** The message every caller shows when no audio provider is configured —
 *  the same shape the video path uses. */
export const NO_AUDIO_PROVIDER_MESSAGE =
  'No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers.';

export interface GenerateAudioAssetRequest {
  kind: AudioGenerationKind;
  prompt?: string;
  durationSec?: number;
  loop?: boolean;
  promptInfluence?: number;
  compositionPlan?: AudioCompositionPlan;
  seed?: number;
  instrumental?: boolean;
  outputFormat?: AudioOutputFormat;
  /** Audio provider id; defaults to the engine's active provider. */
  providerId?: string;
  /** Library folder; defaults to `generated/`. */
  folder?: string;
  /** Brand to auto-tag. Stale ids degrade to untagged — the clip still files. */
  brandId?: string;
  /** Usage attribution. Defaults to Studio's shot asset, like the video path. */
  featureSource?: AiFeatureSource;
  /** `<namespace>/<name>` when an agent asked for it (agents plan §9). */
  agentId?: string;
  signal?: AbortSignal;
}

export interface GeneratedAudioAsset {
  relPath: string;
  kind: AudioGenerationKind;
  durationSeconds: number;
  description: string;
  providerId: string;
  model: string;
  brandId?: string;
  costUsd?: number;
}

/** The library description: the prompt, or a plan's styles and sections. */
export function describeAudioRequest(req: GenerateAudioAssetRequest): string {
  const prompt = req.prompt?.trim();
  if (prompt) return prompt;
  const plan = req.compositionPlan;
  if (!plan) return req.kind === 'sfx' ? 'Sound effect' : 'Music';
  const styles = (plan.positiveGlobalStyles ?? []).join(', ');
  const sections = plan.sections.map((s) => s.name).join(' → ');
  return [styles, sections].filter((s) => s.length > 0).join(' — ') || 'Music';
}

/** True when a provider is registered and a generation can be attempted. */
export async function hasAudioProvider(): Promise<boolean> {
  await ensureAudioGenerationEngine();
  return audioGenerationEngine.getActiveProvider() !== null;
}

export async function generateAudioAsset(req: GenerateAudioAssetRequest): Promise<GeneratedAudioAsset> {
  if (!(await hasAudioProvider())) throw new Error(NO_AUDIO_PROVIDER_MESSAGE);

  const result = await audioGenerationEngine.generate({
    kind: req.kind,
    ...(req.providerId ? { providerId: req.providerId } : {}),
    ...(req.prompt !== undefined ? { prompt: req.prompt } : {}),
    ...(req.durationSec !== undefined ? { durationSec: req.durationSec } : {}),
    ...(req.loop !== undefined ? { loop: req.loop } : {}),
    ...(req.promptInfluence !== undefined ? { promptInfluence: req.promptInfluence } : {}),
    ...(req.compositionPlan ? { compositionPlan: req.compositionPlan } : {}),
    ...(req.seed !== undefined ? { seed: req.seed } : {}),
    ...(req.instrumental !== undefined ? { instrumental: req.instrumental } : {}),
    ...(req.outputFormat ? { outputFormat: req.outputFormat } : {}),
    featureSource: req.featureSource ?? 'studio-shot-asset',
    ...(req.agentId ? { agentId: req.agentId } : {}),
    ...(req.signal ? { signal: req.signal } : {}),
  });

  const root = await ensureLibraryRoot();
  const folder = sanitizeFolder(req.folder, GENERATED_FOLDER);
  const description = describeAudioRequest(req);
  const base = `${req.kind}-${slugify(description)}`;
  const { relPath, absPath } = await reserveLibraryFile(root, folder, base, result.ext);
  await fs.writeFile(absPath, result.bytes);

  // Auto-tag only a brand that still exists — a stale default never plants
  // a dangling tag.
  const brand = req.brandId ? await readBrand(root, req.brandId) : null;
  await upsertEntry(root, relPath, {
    origin: 'generated',
    description,
    ...(brand ? { brandId: brand.id } : {}),
  });

  return {
    relPath,
    kind: req.kind,
    durationSeconds: result.durationSec,
    description,
    providerId: result.providerId,
    model: result.model,
    ...(brand ? { brandId: brand.id } : {}),
    ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
  };
}
