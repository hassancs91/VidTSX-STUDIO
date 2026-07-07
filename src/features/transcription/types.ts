// Re-export shared types for feature-local use
export type {
  TranscriptSegment,
  TranscriptResult,
  TranscriptionProjectData,
  TranscriptionProjectListEntry,
  TranscribeEngine,
  SttTranscribeProgressEvent,
} from '@shared/ipc/types';
export type { WhisperModel } from '@shared/ipc/types';

// STT catalog (single source of truth, shared with auto-cut).
export {
  STT_CATALOG,
  DEFAULT_STT_MODEL,
  findSttEntry,
  coerceSttEntry,
  type SttCatalogEntry,
  type SttModelFeatures,
} from '@shared/presets/stt-models';

// UI-specific state types. 'uploading' is cloud-only (audio → provider).
export type TranscriptionPhase =
  | 'idle'
  | 'extracting'
  | 'uploading'
  | 'transcribing'
  | 'parsing'
  | 'complete'
  | 'error';

export interface TranscriptionState {
  phase: TranscriptionPhase;
  progress: number;
  message: string;
  result: import('@shared/ipc/types').TranscriptResult | null;
  error: string | null;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: 'video' | 'audio';
}

export type ExportFormat = 'srt' | 'vtt' | 'json' | 'txt';

// Accepted media file extensions (single source of truth)
export const ACCEPTED_MEDIA_EXTENSIONS = [
  'mp4', 'mkv', 'avi', 'mov', 'webm',  // video
  'mp3', 'wav', 'm4a', 'flac', 'ogg',  // audio
] as const;

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'flac', 'ogg']);

export function isAudioExtension(ext: string): boolean {
  return AUDIO_EXTENSIONS.has(ext);
}

// Supported languages for whisper
export const WHISPER_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'hi', name: 'Hindi' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
] as const;

export type WhisperLanguageCode = (typeof WHISPER_LANGUAGES)[number]['code'];

// Cloud STT providers can auto-detect the language, so they get an extra
// option on top of the explicit list above.
export const CLOUD_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  ...WHISPER_LANGUAGES,
] as const;
