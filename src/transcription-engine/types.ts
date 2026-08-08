import type { TranscriptResult } from '../shared/ipc/types/whisper';
import type { SttProviderConfig, SttProviderType } from '../shared/ipc/types/stt';
import type { SttModelFeatures } from '../shared/presets/stt-models';

export type { SttProviderConfig, SttProviderType };

/** Seconds-based word with optional confidence + speaker (AssemblyAI). */
export interface SttWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
  speaker?: string;
}

export interface SttUtterance {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
}

export interface SttHighlight {
  text: string;
  count: number;
  rank: number;
  timestamps: Array<{ start: number; end: number }>;
}

export interface SttSentiment {
  text: string;
  start: number;
  end: number;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

/**
 * Canonical transcript plus optional rich extras (auto-cut consumes these;
 * the transcribe feature only needs `result`).
 *
 * Optional signals stay `undefined` when the engine didn't produce them —
 * never normalized to `[]` — so consumers can tell "not available" apart
 * from "available and empty".
 */
export interface SttRichResult {
  result: TranscriptResult;
  words?: SttWord[];
  utterances?: SttUtterance[];
  highlights?: SttHighlight[];
  sentiments?: SttSentiment[];
  /**
   * What this run actually delivered, which may be narrower than the
   * catalog's advertised features (e.g. whisper fell back from measured to
   * approximate word timing). Absent = assume the catalog entry's features.
   */
  features?: SttModelFeatures;
}

/** Input is ALWAYS a prepared local audio file — the pipeline does extraction. */
export interface ProviderTranscribeRequest {
  audioPath: string;
  /** Provider-native model id (not the namespaced catalog id). */
  model: string;
  /** ISO code; undefined = auto-detect. */
  language?: string;
  detectSpeakers?: boolean;
  enableHighlights?: boolean;
  enableSentiment?: boolean;
  /**
   * Keep verbal disfluencies ("um", "uh") verbatim when the provider supports
   * it. Auto-cut wants them (fillers are cut material); captions usually don't.
   */
  verbatim?: boolean;
  signal: AbortSignal;
  /** Progress within the provider's own work, 0..100. */
  onProgress: (percent: number, message: string) => void;
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly type: SttProviderType;
  getCapabilities(model: string): SttModelFeatures;
  transcribe(req: ProviderTranscribeRequest): Promise<SttRichResult>;
  /** Best-effort cancellation of provider-local work (e.g. kill a child process). */
  cancel?(): void;
}

export class TranscriptionEngineError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TranscriptionEngineError';
  }
}
