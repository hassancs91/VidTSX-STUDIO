export type AudioModelType = 'stt' | 'tts';

/** online = streaming (live mic), offline = batch (file transcription) */
export type SttMode = 'online' | 'offline';

export interface SttSherpaConfig {
  type: 'stt';
  modelType: 'transducer' | 'paraformer' | 'whisper' | 'nemo-ctc';
  sampleRate: number;
  encoder: string;
  decoder: string;
  joiner?: string;
  tokens: string;
}

export interface TtsSherpaConfig {
  type: 'tts';
  modelType: 'vits' | 'piper';
  sampleRate: number;
  model: string;
  tokens: string;
  lexicon?: string;
  dataDir?: string;
  numSpeakers: number;
  defaultSpeakerId: number;
}

export type SherpaConfig = SttSherpaConfig | TtsSherpaConfig;

export interface AudioModelDefinition {
  id: string;
  name: string;
  type: AudioModelType;
  sttMode?: SttMode;
  language: string;
  sizeBytes: number;
  sizeLabel: string;
  /** Relative path appended to MODELS_BASE_URL for download */
  downloadPath: string;
  /** Archive format of the download */
  archiveFormat: 'tar.bz2' | 'tar.gz' | 'zip';
  /** Name of the extracted folder inside the archive */
  extractedDirName: string;
  /** Relative file paths within the extracted model directory */
  files: string[];
  sherpaConfig: SherpaConfig;
  /** If true, model is excluded from the UI */
  hidden?: boolean;
}

export interface SttSegment {
  start: number;
  end: number;
  text: string;
}

export interface SttResult {
  text: string;
  segments: SttSegment[];
  language: string;
  durationSeconds: number;
}

export interface SttPartialResult {
  text: string;
  isEndpoint: boolean;
}

export interface TtsRequest {
  text: string;
  speakerId?: number;
  speed?: number;
}

export interface TtsResult {
  audioBuffer: Buffer;
  sampleRate: number;
  durationSeconds: number;
}

export interface AudioDownloadProgress {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}
