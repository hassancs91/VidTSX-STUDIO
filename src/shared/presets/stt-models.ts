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

/**
 * Which transcription capabilities a model supports.
 *
 * Doubles as the per-run snapshot Studio records in the project document at
 * transcription time: there the flags describe what that run actually
 * delivered (e.g. whisper fell back to approximate timing), which may be
 * narrower than what the catalog advertises. Consumers branch on these flags,
 * never on provider names — a missing capability is compensated for
 * (approximate timing → wider RMS snap pads; no speakers → single-speaker),
 * not refused.
 */
export interface SttModelFeatures {
  /** Measured word-level timestamps (AssemblyAI; whisper via token-level JSON). */
  wordTimestamps: boolean;
  /**
   * Word timing approximated from segment bounds by character distribution.
   * The whisper fallback when token-level data is unavailable.
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
  /**
   * Verbal disfluencies ("um", "uh") kept verbatim in the transcript. The
   * auto-cut filler pass was calibrated on verbatim text; engines that tidy
   * disfluencies away will under-find filler cuts (the QA readout says so).
   */
  verbatimDisfluencies: boolean;
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
  /**
   * Estimated price per audio hour, for the usage dashboard's cost column
   * only (multiplied by transcript duration). Informational like priceText —
   * absent/unknown logs $0. Local models omit it (free).
   */
  pricePerHourUsd?: number;
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
  verbatimDisfluencies: false,
};

// whisper.cpp emits measured token-level times with -ojf (verified against the
// v1.8.3 binary the app downloads); character-distribution approximation stays
// as the fallback when a run yields no token data. Per-run snapshots narrow
// these two flags to what actually happened.
const WHISPER_FEATURES: SttModelFeatures = {
  ...NO_FEATURES,
  wordTimestamps: true,
  approximateWordTimestamps: true,
};

const ASSEMBLYAI_FEATURES: SttModelFeatures = {
  ...NO_FEATURES,
  wordTimestamps: true,
  speakerLabels: true,
  highlights: true,
  sentiment: true,
  verbatimDisfluencies: true,
};

// verbatimDisfluencies deliberately OFF until Scribe's verbatim behavior is
// verified on real footage (Q3, decided 2026-08-21) — the auto-cut filler
// pass depends on verbatim "um"/"uh", so AssemblyAI stays the recommended
// pick for the editorial pass until then.
const ELEVENLABS_FEATURES: SttModelFeatures = {
  ...NO_FEATURES,
  wordTimestamps: true,
  speakerLabels: true,
  audioEvents: true,
};

export const STT_CATALOG: readonly SttCatalogEntry[] = [
  // ── Local whisper.cpp (free, offline) — ids match whisper.ts MODEL_DEFINITIONS ──
  { id: 'local-whisper/tiny', provider: 'local-whisper', model: 'tiny', name: 'Whisper Tiny (75 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/base', provider: 'local-whisper', model: 'base', name: 'Whisper Base (142 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/small', provider: 'local-whisper', model: 'small', name: 'Whisper Small (466 MB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/medium', provider: 'local-whisper', model: 'medium', name: 'Whisper Medium (1.5 GB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },
  { id: 'local-whisper/large-v3', provider: 'local-whisper', model: 'large-v3', name: 'Whisper Large-v3 (3.1 GB)', priceText: 'Free — runs locally', requiresDownload: true, features: WHISPER_FEATURES },

  // ── AssemblyAI (exact word timestamps, speakers, highlights, sentiment) ──
  // 'universal' is the auto pair (universal-3-5-pro with universal-2 fallback,
  // resolved in the provider); the pinned entries pass through as-is.
  { id: 'assemblyai/universal', provider: 'assemblyai', model: 'universal', name: 'AssemblyAI Universal (auto)', priceText: '~$0.21 / hour', pricePerHourUsd: 0.21, features: ASSEMBLYAI_FEATURES },
  { id: 'assemblyai/universal-3-5-pro', provider: 'assemblyai', model: 'universal-3-5-pro', name: 'AssemblyAI Universal-3.5 Pro', priceText: '~$0.21 / hour', pricePerHourUsd: 0.21, features: ASSEMBLYAI_FEATURES },
  { id: 'assemblyai/universal-2', provider: 'assemblyai', model: 'universal-2', name: 'AssemblyAI Universal-2 (multilingual)', priceText: '~$0.15 / hour', pricePerHourUsd: 0.15, features: ASSEMBLYAI_FEATURES },

  // ── ElevenLabs Scribe (exact word timestamps, up to 32 speakers, audio events) ──
  { id: 'elevenlabs/scribe-v2', provider: 'elevenlabs', model: 'scribe_v2', name: 'ElevenLabs Scribe v2', priceText: '~$0.22 / hour', pricePerHourUsd: 0.22, features: ELEVENLABS_FEATURES },

  // ── OpenRouter (plain text only — no timestamps; 60s upstream timeout per chunk) ──
  { id: 'openrouter/openai/whisper-large-v3-turbo', provider: 'openrouter', model: 'openai/whisper-large-v3-turbo', name: 'Whisper Large-v3 Turbo (OpenRouter)', priceText: 'per-minute, see openrouter.ai', maxDurationMinutes: 60, features: NO_FEATURES },
  { id: 'openrouter/openai/whisper-large-v3', provider: 'openrouter', model: 'openai/whisper-large-v3', name: 'Whisper Large-v3 (OpenRouter)', priceText: 'per-minute, see openrouter.ai', maxDurationMinutes: 60, features: NO_FEATURES },
  { id: 'openrouter/openai/whisper-1', provider: 'openrouter', model: 'openai/whisper-1', name: 'Whisper 1 (OpenRouter)', priceText: '~$0.006 / minute', pricePerHourUsd: 0.36, maxDurationMinutes: 60, features: NO_FEATURES },
];

/** Free + offline once the model is downloaded; works with zero configuration. */
export const DEFAULT_STT_MODEL = 'local-whisper/base' as const;

/** Display names for provider-facing UI copy (missing-key warnings etc.). */
export const STT_PROVIDER_LABELS: Record<SttProviderType, string> = {
  'local-whisper': 'Local Whisper',
  assemblyai: 'AssemblyAI',
  elevenlabs: 'ElevenLabs',
  openrouter: 'OpenRouter',
};

export function findSttEntry(id: string): SttCatalogEntry | undefined {
  return STT_CATALOG.find((m) => m.id === id);
}

/** Ids that once shipped in the catalog, mapped to their living replacement. */
const LEGACY_STT_ALIASES: Record<string, string> = {
  // AssemblyAI retired slam-1 (2026) — the API rejects it as a speech model.
  'assemblyai/slam-1': 'assemblyai/universal',
};

/**
 * Map an unknown/legacy id (e.g. removed vidtsx-stt-* ids or bare whisper model
 * ids persisted by older versions) onto a catalog entry, else the default.
 */
export function coerceSttEntry(id: string | undefined): SttCatalogEntry {
  if (id) {
    const direct = findSttEntry(id);
    if (direct) return direct;
    const aliased = LEGACY_STT_ALIASES[id] ? findSttEntry(LEGACY_STT_ALIASES[id]) : undefined;
    if (aliased) return aliased;
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
