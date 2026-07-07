export type EmbeddingModelSize = 'small' | 'medium';

export interface EmbeddingModelDefinition {
  id: string;
  name: string;
  size: EmbeddingModelSize;
  language: string;
  /** Output vector dimensions (e.g. 384, 768, 1024) */
  dimensions: number;
  /** Maximum input sequence length in tokens */
  maxTokens: number;
  sizeBytes: number;
  sizeLabel: string;
  /** HuggingFace repo ID, e.g. "Xenova/all-MiniLM-L6-v2" */
  hfRepoId: string;
  /** Files to download from the HF repo */
  files: string[];
  /** If true, model is excluded from the UI */
  hidden?: boolean;
}

// ── Worker thread message types ──────────────────────────────

export type EmbeddingWorkerRequest =
  | { type: 'loadModel'; modelId: string; modelPath: string }
  | { type: 'embed'; requestId: string; texts: string[]; normalize: boolean }
  | { type: 'unloadModel' };

export type EmbeddingWorkerResponse =
  | { type: 'modelLoaded'; modelId: string }
  | { type: 'embedResult'; requestId: string; embeddings: number[][]; dimensions: number }
  | { type: 'error'; requestId?: string; error: string }
  | { type: 'modelUnloaded' };

// ── Public API types ─────────────────────────────────────────

export interface EmbedRequest {
  texts: string[];
  /** L2-normalize embeddings (default true) */
  normalize?: boolean;
}

export interface EmbedResult {
  embeddings: number[][];
  dimensions: number;
  modelId: string;
}
