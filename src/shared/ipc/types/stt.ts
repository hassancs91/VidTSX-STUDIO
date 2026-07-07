/**
 * Provider-agnostic transcription IPC types (local whisper / AssemblyAI /
 * OpenRouter). Replaces the removed VidtsxTranscribeRun* surface — the
 * request/progress/response shapes mirror it so renderer hooks migrate with
 * channel renames only.
 */

import type { TranscriptResult } from './whisper';

export type SttProviderType = 'local-whisper' | 'assemblyai' | 'openrouter';

/** Provider configuration stored in user settings (mirrors ImageProviderConfig). */
export interface SttProviderConfig {
  id: string;
  name: string;
  type: SttProviderType;
  /** Empty for local-whisper; resolved from shared provider credentials otherwise. */
  apiKey: string;
  defaultModel: string;
  enabled: boolean;
}

export interface SttTranscribeRunRequest {
  /** Source video or audio file path. */
  inputPath: string;
  /** STT catalog id from @shared/presets/stt-models (e.g. 'assemblyai/universal'). */
  sttModelId: string;
  /** ISO code (e.g. 'en') or 'auto' / undefined for auto-detect. */
  language?: string;
  /** Group/label the transcript by speaker (capability-gated per model). */
  detectSpeakers?: boolean;
  enableHighlights?: boolean;
  enableSentiment?: boolean;
}

export type SttTranscribePhase = 'extracting' | 'uploading' | 'transcribing' | 'parsing';

export interface SttTranscribeProgressEvent {
  phase: SttTranscribePhase;
  percent: number;
  message?: string;
}

// Whisper-shaped for symmetry with whisperTranscribe, so renderer hooks can
// treat every engine's result identically.
export interface SttTranscribeRunResponse {
  success: boolean;
  result?: TranscriptResult;
  error?: string;
}

export interface SttTranscribeCancelResponse {
  success: boolean;
}

export interface SttProvidersGetResponse {
  success: boolean;
  providers: SttProviderConfig[];
  activeProvider?: string;
  error?: string;
}

export interface SttProvidersSaveRequest {
  providers: SttProviderConfig[];
  activeProvider?: string;
}

export interface SttProvidersSaveResponse {
  success: boolean;
  error?: string;
}
