// ─── Whisper binary operations ───
// Whisper binary operations
export interface WhisperBinaryStatusResponse {
  installed: boolean;
  path: string;
}

export interface WhisperBinaryInstallResponse {
  success: boolean;
  error?: string;
}

export interface WhisperProgressEvent {
  type: 'binary' | 'model';
  modelId?: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

// ─── Whisper model operations ───
// Whisper model operations
export interface WhisperModel {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  downloaded: boolean;
}

export interface WhisperModelsListResponse {
  models: WhisperModel[];
  error?: string;
}

export interface WhisperModelDownloadRequest {
  modelId: string;
}

export interface WhisperModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface WhisperModelDeleteRequest {
  modelId: string;
}

export interface WhisperModelDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Per-word timestamps inside a transcript segment ───
// Optional on TranscriptSegment — present when the source supports word-level
// timing (e.g. vidtsx-stt-smart / vidtsx-stt-premium). Whisper-based callers
// can omit it, in which case caption templates that want per-word animation
// (Karaoke, Highlight Box, Word Pop, etc.) fall back to character-distribution.
export interface CaptionWord {
  text: string;
  start: number; // seconds (same time domain as the parent segment)
  end: number;
}

// ─── Transcript segment from whisper output ───
// Transcript segment from whisper output
export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
  // Optional per-word timing — see CaptionWord for the contract.
  words?: CaptionWord[];
  // Optional speaker label — present when the source diarizes (vidtsx-stt-smart
  // / -premium with "Detect speakers"). Omitted by Whisper and Fast tier.
  speaker?: string;
  // ─── Per-segment caption overrides ──────────────────────────────────────
  // Studio-only: store deltas the user applied to this single segment from
  // the studio Captions tab. They're partials — only keys the user actually
  // changed live here; everything else falls back to project-level settings
  // via merging at render time.
  //
  // `baseOverrides` overrides Layout settings (position, fontSize).
  // `styleOverrides` is keyed by `CaptionStyleId` so switching styles globally
  // preserves the segment's per-style customisation under each id; the
  // template picks up only the entry matching the currently active style.
  baseOverrides?: Partial<{ position: { x: number; y: number }; fontSize: number }>;
  styleOverrides?: Record<string, Record<string, unknown>>;
}

// ─── Full transcription result ───
// Full transcription result
export interface TranscriptResult {
  language: string;
  duration: number; // total audio duration in seconds
  segments: TranscriptSegment[];
  text: string; // full concatenated text
}

// ─── Whisper transcribe request ───
// Whisper transcribe request
export interface WhisperTranscribeRequest {
  inputPath: string; // video or audio file path
  modelId: string; // tiny, base, small, medium, large-v3
  language?: string; // ISO code like 'en', 'es', or undefined for auto-detect
}

// ─── Whisper transcribe response ───
// Whisper transcribe response
export interface WhisperTranscribeResponse {
  success: boolean;
  result?: TranscriptResult;
  error?: string;
}

// ─── Transcription progress event (pushed via webContents.send) ───
// Transcription progress event (pushed via webContents.send)
export interface WhisperTranscribeProgressEvent {
  phase: 'extracting' | 'transcribing' | 'parsing';
  percent: number;
  message?: string;
}

// ─── Cancel transcription response ───
// Cancel transcription response
export interface WhisperTranscribeCancelResponse {
  success: boolean;
}
