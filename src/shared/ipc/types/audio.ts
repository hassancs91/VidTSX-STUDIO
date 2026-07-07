// ─── Audio Engine types ───
export interface AudioStatusResponse {
  available: boolean;
  version?: string;
  activeSttModelId: string | null;
  activeTtsModelId: string | null;
}

export interface AudioModelIpc {
  id: string;
  name: string;
  type: 'stt' | 'tts';
  sttMode?: 'online' | 'offline';
  language: string;
  sizeLabel: string;
  sizeBytes: number;
  downloaded: boolean;
  numSpeakers?: number;
  /** Absolute path to model directory (only set when downloaded) */
  modelPath?: string;
}

export interface AudioModelsListRequest {
  type?: 'stt' | 'tts';
}

export interface AudioModelsListResponse {
  models: AudioModelIpc[];
}

export interface AudioModelDownloadRequest {
  modelId: string;
}

export interface AudioModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface AudioModelDeleteRequest {
  modelId: string;
}

export interface AudioModelDeleteResponse {
  success: boolean;
  error?: string;
}

export interface AudioDownloadProgressEvent {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface AudioSttLoadModelRequest {
  modelId: string;
}

export interface AudioSttLoadModelResponse {
  success: boolean;
  error?: string;
}

export interface AudioSttTranscribeRequest {
  inputPath: string;
  language?: string;
}

export interface AudioSttTranscribeResponse {
  success: boolean;
  result?: {
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
    language: string;
    durationSeconds: number;
  };
  error?: string;
}

export interface AudioSttStreamStartResponse {
  success: boolean;
  error?: string;
}

export interface AudioSttStreamFeedRequest {
  samplesBase64: string;
  sampleRate: number;
}

export interface AudioSttStreamFeedResponse {
  success: boolean;
}

export interface AudioSttStreamStopResponse {
  success: boolean;
  result?: {
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
  };
  error?: string;
}

export interface AudioSttPartialEvent {
  text: string;
  isEndpoint: boolean;
}

export interface AudioTtsLoadModelRequest {
  modelId: string;
}

export interface AudioTtsLoadModelResponse {
  success: boolean;
  error?: string;
}

export interface AudioTtsGenerateRequest {
  text: string;
  speakerId?: number;
  speed?: number;
}

export interface AudioTtsGenerateResponse {
  success: boolean;
  audioBase64?: string;
  sampleRate?: number;
  durationSeconds?: number;
  error?: string;
}

export interface AudioSettingsGetResponse {
  activeSttModelId: string | null;
  activeTtsModelId: string | null;
}

export interface AudioSettingsSaveRequest {
  activeSttModelId?: string;
  activeTtsModelId?: string;
}

export interface AudioSettingsSaveResponse {
  success: boolean;
  error?: string;
}
