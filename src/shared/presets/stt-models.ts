/**
 * Single source of truth for speech-to-text (transcription) models across all
 * providers — local whisper.cpp, AssemblyAI, and OpenRouter. Any tool
 * (transcribe feature, auto-cut, a settings picker) reads model ids, display
 * names, informational pricing, duration caps, and per-model feature support
 * from one place.
 *
 * Catalog ids are namespaced '<provider>/<model>' so a single id identifies
 * both the provider and its native model id.
 */

import type { SttProviderType } from '../ipc/types/stt';

/** Which transcription capabilities a model supports. */
export interface SttModelFeatures {
  /** Exact word-level timestamps (AssemblyAI). */
  wordTimestamps: boolean;
  /**
   * Approximate word timing derived from segment bounds (local whisper).
   * Good enough for captions/auto-cut, less precise than exact timing.
   */
  approximateWordTimestamps: boolean;
  /** Speaker labels / diarization. */
  speakerLabels: boolean;
  /** Auto highlights. */
  highlights: boolean;
  /** Sentiment analysis. */
  sentiment: boolean;
  /** Audio event tagging. */
  audioEvents: boolean;
}

export interface SttCatalogEntry {
  /** Namespaced catalog id, e.g. 'local-whisper/base', 'assemblyai/universal'. */
  id: string;
  provider: SttProviderType;
  /** Provider-native model id (whisper model id, AssemblyAI speech_model, OpenRouter slug). */
  model: string;
  /** Display name. */
  name: string;
  /** Informational price display — no billing logic in the app. */
  priceText?: string;
  /** Enforced cap, in minutes (OpenRouter text-only entries). */
  maxDurationMinutes?: number;
  /** Local whisper models must be downloaded before use. */
  requiresDownload?: boolean;
  features: SttModelFeatures;
}

const NO_FEATURES: SttModelFeatures = {
  wordTimestamps: false,
  approximateWordTimestamps: false,
  speakerLabels: false,
  highlights: false,
  sentiment: false,
  audioEvents: false,
};

const WHISPER_FEATURES: SttModelFeatures = {
  ...NO_FEATURES,
  approximateWordTimestamps: true,
};

const ASSEMBLYAI_FEATURES: SttModelFeatures = {
  ...NO_FEATURES,
  wordTimestamps: true,
  speakerLabels: true,
  highlights: true,
  sentiment: true,
};

export const STT_CATALOG: readonly SttCatalogEntry[] = [
  // ── Local whisper.cpp (free, offline) — ids match whisper.ts MODEL_DEFINITIONS ──
  { id: 'local-whisper/tiny', provider: 'local-whisper', model: 'tiny', name: 'Whisper Tiny (75 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/base', provider: 'local-whisper', model: 'base', name: 'Whisper Base (142 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/small', provider: 'local-whisper', model: 'small', name: 'Whisper Small (466 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/medium', provider: 'local-whisper', model: 'medium', name: 'Whisper Medium (1.5 GB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/large-v3', provider: 'local-whisper', model: 'large-v3', name: 'Whisper Large-v3 (3.1 GB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },

  // ── AssemblyAI (exact word timestamps, speakers, highlights, sentiment) ──
  { id: 'assemblyai/universal', provider: 'assemblyai', model: 'universal', name: 'AssemblyAI Universal', priceText: '~$0.27 / hour', features: ASSEMBLYAI_FEATURES },
  { id: 'assemblyai/slam-1', provider: 'assemblyai', model: 'slam-1', name: 'AssemblyAI Slam-1 (English)', priceText: '~$0.27 / hour', features: ASSEMBLYAI_FEATURES },

  // ── OpenRouter (plain text only — no timestamps; 60s upstream timeout per chunk) ──
  { id: 'openrouter/openai/whisper-large-v3-turbo', provider: 'openrouter', model: 'openai/whisper-large-v3-turbo', name: 'Whisper Large-v3 Turbo (OpenRouter)', priceText: 'per-minute, see openrouter.ai', maxDurationMinutes: 60, features: NO_FEATURES },
  { id: 'openrouter/openai/whisper-large-v3', provider: 'openrouter', model: 'openai/whisper-large-v3', name: 'Whisper Large-v3 (OpenRouter)', priceText: 'per-minute, see openrouter.ai', maxDurationMinutes: 60, features: NO_FEATURES },
  { id: 'openrouter/openai/whisper-1', provider: 'openrouter', model: 'openai/whisper-1', name: 'Whisper 1 (OpenRouter)', priceText: '~$0.006 / minute', maxDurationMinutes: 60, features: NO_FEATURES },
];

/** Free + offline once the model is downloaded; works with zero configuration. */
export const DEFAULT_STT_MODEL = 'local-whisper/base' as const;

export function findSttEntry(id: string): SttCatalogEntry | undefined {
  return STT_CATALOG.find((m) => m.id === id);
}

/**
 * Map an unknown/legacy id (e.g. removed vidtsx-stt-* ids or bare whisper model
 * ids persisted by older versions) onto a catalog entry, else the default.
 */
export function coerceSttEntry(id: string | undefined): SttCatalogEntry {
  if (id) {
    const direct = findSttEntry(id);
    if (direct) return direct;
    const asLocal = findSttEntry(`local-whisper/${id}`);
    if (asLocal) return asLocal;
  }
  return findSttEntry(DEFAULT_STT_MODEL)!;
}

/**
 * Models usable where caption/cut timing is required (exact OR approximate
 * word timestamps). This is the auto-cut filter — OpenRouter's text-only
 * entries are excluded automatically.
 */
export function sttEntriesWithTimestamps(): SttCatalogEntry[] {
  return STT_CATALOG.filter(
    (m) => m.features.wordTimestamps || m.features.approximateWordTimestamps,
  );
}
