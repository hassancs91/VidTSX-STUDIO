// ─── Model Definitions ─────────────────────────────────────────────

export type LlmQuantization = 'Q4_0' | 'Q4_K_M' | 'Q5_K_M' | 'Q6_K' | 'Q8_0' | 'F16';

export type LlmCapability = 'vision' | 'coding' | 'reasoning' | 'multilingual';

export interface LlmModelDefinition {
  id: string;
  name: string;
  family: string;
  parameterCount: string;
  quantization: LlmQuantization;
  contextLength: number;
  sizeBytes: number;
  sizeLabel: string;
  /** Full download URL to the single .gguf file */
  downloadUrl: string;
  /** File name of the .gguf file stored in userData/ai-models/llm/ */
  fileName: string;
  /** Short description of what the model excels at */
  description: string;
  /** Model capabilities for filtering and badges */
  capabilities: LlmCapability[];
  /** Release date in YYYY-MM format */
  releaseDate: string;
  /** If true, model is excluded from the UI */
  hidden?: boolean;
}

// ─── Generation ────────────────────────────────────────────────────

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerationParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  repeatPenalty?: number;
  seed?: number;
  stop?: string[];
  responseFormat?: 'text' | 'json';
}

export interface LlmCompletionRequest {
  prompt: string;
  params?: LlmGenerationParams;
  stream?: boolean;
}

export interface LlmChatRequest {
  messages: LlmChatMessage[];
  params?: LlmGenerationParams;
  sessionId?: string;
  stream?: boolean;
}

export interface LlmGenerationResult {
  text: string;
  tokensGenerated: number;
  tokensPerSecond: number;
  stopReason: 'stop' | 'maxTokens' | 'cancelled';
  sessionId?: string;
}

// ─── Streaming ─────────────────────────────────────────────────────

export interface LlmTokenEvent {
  requestId: string;
  token: string;
  text: string;
}

export interface LlmCompleteEvent {
  requestId: string;
  result: LlmGenerationResult;
}

// ─── Download ──────────────────────────────────────────────────────

export interface LlmDownloadProgress {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

// ─── GPU ───────────────────────────────────────────────────────────

export type GpuBackend = 'cuda' | 'vulkan' | 'metal' | 'cpu';

export interface LlmGpuInfo {
  backend: GpuBackend;
  deviceName?: string;
  vramMb?: number;
}
