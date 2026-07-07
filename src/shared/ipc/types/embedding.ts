// ─── Embedding Engine types ───
export interface EmbeddingModelIpc {
  id: string;
  name: string;
  size: 'small' | 'medium';
  language: string;
  dimensions: number;
  maxTokens: number;
  sizeLabel: string;
  sizeBytes: number;
  downloaded: boolean;
  /** Absolute path to model directory (only set when downloaded) */
  modelPath?: string;
}

export interface EmbeddingModelsListResponse {
  models: EmbeddingModelIpc[];
}

export interface EmbeddingModelDownloadRequest {
  modelId: string;
}

export interface EmbeddingModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface EmbeddingModelDeleteRequest {
  modelId: string;
}

export interface EmbeddingModelDeleteResponse {
  success: boolean;
  error?: string;
}

export interface EmbeddingDownloadProgressEvent {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface EmbeddingLoadModelRequest {
  modelId: string;
}

export interface EmbeddingLoadModelResponse {
  success: boolean;
  error?: string;
}

export interface EmbeddingUnloadModelResponse {
  success: boolean;
  error?: string;
}

export interface EmbeddingEmbedRequest {
  texts: string[];
  normalize?: boolean;
}

export interface EmbeddingEmbedResponse {
  success: boolean;
  embeddings?: number[][];
  dimensions?: number;
  error?: string;
}
