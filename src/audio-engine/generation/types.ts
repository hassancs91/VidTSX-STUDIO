// Cloud audio generation — sound effects and music (V1 completion plan §2.2
// W2b). One request shape for both kinds; providers sit behind the engine so
// usage logging and library filing are the engine's, never a tool's (§4).
//
// This module is deliberately separate from `src/audio-engine/audio-engine.ts`
// (the local sherpa-onnx STT/TTS bridge): it loads no native addon and is safe
// to import from any main-process service or test.

import type { ProviderKeyId } from '../../shared/providers/registry';
import type { AiFeatureSource } from '../../shared/types/ai-usage';

export type AudioGenerationKind = 'sfx' | 'music';

/** ElevenLabs `output_format` values the app asks for — MP3 only, so the
 *  library files and the Studio audio lane take them unchanged. */
export type AudioOutputFormat =
  | 'mp3_22050_32'
  | 'mp3_44100_64'
  | 'mp3_44100_96'
  | 'mp3_44100_128'
  | 'mp3_44100_192';

export const DEFAULT_AUDIO_OUTPUT_FORMAT: AudioOutputFormat = 'mp3_44100_128';

/** SFX bounds (ElevenLabs `duration_seconds`, API reference 2026-09-10). */
export const SFX_MIN_SECONDS = 0.5;
export const SFX_MAX_SECONDS = 30;
/** Music bounds (`music_length_ms` 3 000–600 000). */
export const MUSIC_MIN_SECONDS = 3;
export const MUSIC_MAX_SECONDS = 600;

/** One section of a music composition plan (the structured alternative to a
 *  prompt). Field names are ours; the provider maps them to its wire form. */
export interface AudioCompositionSection {
  name: string;
  durationSec: number;
  positiveStyles?: string[];
  negativeStyles?: string[];
  /** Lyric lines; empty for an instrumental section. */
  lines?: string[];
}

export interface AudioCompositionPlan {
  positiveGlobalStyles?: string[];
  negativeGlobalStyles?: string[];
  sections: AudioCompositionSection[];
}

/** What every caller passes; the engine validates it against the kind. */
export interface AudioGenerationRequest {
  /** Default: the active audio provider. */
  providerId?: string;
  kind: AudioGenerationKind;
  /** The sound or the song, in words. Music: required unless a plan is given. */
  prompt?: string;
  /** SFX 0.5–30 s (omit → the model picks); music 3–600 s. */
  durationSec?: number;
  /** SFX only: make it loop seamlessly. */
  loop?: boolean;
  /** SFX only: 0–1, how literally to follow the prompt (provider default 0.3). */
  promptInfluence?: number;
  /** Music only: a structured plan INSTEAD of a prompt. */
  compositionPlan?: AudioCompositionPlan;
  /** Music only, and only with a composition plan (the API's rule). */
  seed?: number;
  /** Music only: no vocals. */
  instrumental?: boolean;
  outputFormat?: AudioOutputFormat;
  /** Usage-log attribution. */
  featureSource?: AiFeatureSource;
  /** `<namespace>/<name>` when an agent asked for it (agents plan §9). */
  agentId?: string;
  signal?: AbortSignal;
}

/** The validated request a provider receives. */
export interface AudioProviderRequest {
  kind: AudioGenerationKind;
  prompt?: string;
  durationSec?: number;
  loop?: boolean;
  promptInfluence?: number;
  compositionPlan?: AudioCompositionPlan;
  seed?: number;
  instrumental?: boolean;
  outputFormat: AudioOutputFormat;
  signal?: AbortSignal;
}

export interface AudioProviderResult {
  bytes: Buffer;
  contentType: string;
  /** The model the provider used (`eleven_text_to_sound_v2`, `music_v2`). */
  model: string;
}

/** The interface every audio provider implements — synchronous HTTP, bytes back. */
export interface AudioGenerationProvider {
  readonly id: string;
  generate(request: AudioProviderRequest): Promise<AudioProviderResult>;
  /** Published rate per second of generated audio, when the provider has one. */
  pricePerSecondUsd(kind: AudioGenerationKind): number | undefined;
}

export interface AudioGenerationResult {
  providerId: string;
  model: string;
  kind: AudioGenerationKind;
  bytes: Buffer;
  contentType: string;
  /** File extension for the bytes (`.mp3`). */
  ext: string;
  /** Length of the audio: the requested length, else an estimate from the
   *  MP3's bitrate when the model chose the length itself. */
  durationSec: number;
  /** Wall time of the provider call. */
  elapsedMs: number;
  /** Provider rate × duration, when the rate is known. */
  costUsd?: number;
}

export interface AudioProviderConfig {
  id: string;
  name: string;
  type: 'elevenlabs';
  apiKey: string;
  enabled: boolean;
}

/** A built-in provider definition + the shared BYOK credential that unlocks it. */
export interface AudioProviderPreset extends AudioProviderConfig {
  credentialId: ProviderKeyId;
}

/** What the engine hands its usage sink after every successful generation. */
export interface AudioUsageRecord {
  providerId: string;
  model: string;
  kind: AudioGenerationKind;
  featureSource: AiFeatureSource;
  agentId?: string;
  durationSec: number;
  costUsd: number;
  elapsedMs: number;
}

export type AudioUsageLogger = (usage: AudioUsageRecord) => void;

export class AudioGenerationError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AudioGenerationError';
  }
}
