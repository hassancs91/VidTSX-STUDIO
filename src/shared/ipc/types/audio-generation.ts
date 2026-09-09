/**
 * Cloud audio generation IPC (W2b): sound effects + music through the audio
 * generation engine (src/audio-engine/generation), filed into the asset
 * library. One synchronous call — the providers answer in seconds.
 */

import type { AiFeatureSource } from '../../types/ai-usage';

export type AudioGenerateKind = 'sfx' | 'music';

export interface AudioGenerateCompositionSection {
  name: string;
  durationSec: number;
  positiveStyles?: string[];
  negativeStyles?: string[];
  lines?: string[];
}

export interface AudioGenerateCompositionPlan {
  positiveGlobalStyles?: string[];
  negativeGlobalStyles?: string[];
  sections: AudioGenerateCompositionSection[];
}

export interface AudioGenerateRequest {
  kind: AudioGenerateKind;
  /** Required for SFX; music takes it OR a composition plan. */
  prompt?: string;
  /** SFX 0.5–30 s (omit → auto); music 3–600 s. */
  durationSec?: number;
  /** SFX: loop seamlessly. */
  loop?: boolean;
  /** SFX: 0–1. */
  promptInfluence?: number;
  /** Music: structured plan instead of a prompt. */
  compositionPlan?: AudioGenerateCompositionPlan;
  /** Music, with a plan only. */
  seed?: number;
  /** Music: no vocals. */
  instrumental?: boolean;
  /** Audio provider id; defaults to the active one. */
  providerId?: string;
  /** Library folder; defaults to `generated/`. */
  folder?: string;
  /** Brand to auto-tag. */
  brandId?: string;
  /** Usage attribution; defaults to 'studio-shot-asset'. */
  featureSource?: AiFeatureSource;
}

export interface AudioGeneratedAssetIpc {
  /** Path inside the asset library, relative to its root. */
  relPath: string;
  kind: AudioGenerateKind;
  durationSeconds: number;
  description: string;
  providerId: string;
  model: string;
  brandId?: string;
  costUsd?: number;
}

export interface AudioGenerateResponse {
  success: boolean;
  asset?: AudioGeneratedAssetIpc;
  error?: string;
}
