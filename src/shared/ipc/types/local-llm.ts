// ─── Local LLM Engine types ───
export interface LocalLlmStatusResponse {
  available: boolean;
  activeModelId: string | null;
  gpu: { backend: string; deviceName?: string; vramMb?: number } | null;
}

export interface LocalLlmModelIpc {
  id: string;
  name: string;
  family: string;
  parameterCount: string;
  quantization: string;
  contextLength: number;
  sizeLabel: string;
  sizeBytes: number;
  description: string;
  capabilities: string[];
  releaseDate: string;
  downloaded: boolean;
}

export interface LocalLlmModelsListResponse {
  models: LocalLlmModelIpc[];
}

export interface LocalLlmModelDownloadRequest {
  modelId: string;
}

export interface LocalLlmModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface LocalLlmModelDeleteRequest {
  modelId: string;
}

export interface LocalLlmModelDeleteResponse {
  success: boolean;
  error?: string;
}

export interface LocalLlmDownloadProgressEvent {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface LocalLlmLoadModelRequest {
  modelId: string;
}

export interface LocalLlmLoadModelResponse {
  success: boolean;
  error?: string;
}

export interface LocalLlmUnloadModelResponse {
  success: boolean;
  error?: string;
}

export interface LocalLlmGenerateRequest {
  prompt: string;
  stream?: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  repeatPenalty?: number;
  seed?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
}

export interface LocalLlmGenerateResponse {
  success: boolean;
  requestId?: string;
  result?: {
    text: string;
    tokensGenerated: number;
    tokensPerSecond: number;
    stopReason: string;
  };
  error?: string;
}

export interface LocalLlmChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  sessionId?: string;
  stream?: boolean;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  repeatPenalty?: number;
  seed?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
}

export interface LocalLlmChatResponse {
  success: boolean;
  requestId?: string;
  sessionId?: string;
  result?: {
    text: string;
    tokensGenerated: number;
    tokensPerSecond: number;
    stopReason: string;
  };
  error?: string;
}

export interface LocalLlmTokenEvent {
  requestId: string;
  token: string;
  text: string;
}

export interface LocalLlmCompleteEvent {
  requestId: string;
  result: {
    text: string;
    tokensGenerated: number;
    tokensPerSecond: number;
    stopReason: string;
    sessionId?: string;
  };
}

export interface LocalLlmCancelResponse {
  success: boolean;
}

export interface LocalLlmSessionClearRequest {
  sessionId?: string;
}

export interface LocalLlmSessionClearResponse {
  success: boolean;
}

export interface LocalLlmGpuInfoResponse {
  backend: string;
  deviceName?: string;
  vramMb?: number;
}

export interface LocalLlmSettingsGetResponse {
  activeModelId: string | null;
}

export interface LocalLlmSettingsSaveRequest {
  activeModelId?: string;
}

export interface LocalLlmSettingsSaveResponse {
  success: boolean;
  error?: string;
}
