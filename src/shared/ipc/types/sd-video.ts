// ─── Local video models (Wan via sd-cli) IPC types ───
// The library view uses the generic MODELS_* channels (model-library.ts);
// only the one-click profile download is category-specific.

export interface SdVideoModelDownloadRequest {
  modelId: string;
}

export interface SdVideoModelDownloadResponse {
  success: boolean;
  error?: string;
}

// ─── Generation ───

export interface SdVideoGenerateRequest {
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  /** For image-to-video: absolute path to the first frame. */
  initImagePath?: string;
  offloadToCpu?: boolean;
}

export interface SdVideoGenerateResponse {
  success: boolean;
  requestId?: string;
  /** True when the VRAM preflight auto-enabled CPU offload. */
  autoOffloadEnabled?: boolean;
  error?: string;
  /** Set when Content Safety blocked the request (error carries the copy). */
  blocked?: import('../../content-safety/types').ContentSafetyBlockInfo;
}

export interface SdVideoGenerateProgressEvent {
  requestId: string;
  step: number;
  totalSteps: number;
  percent: number;
}

export interface SdVideoResultIpc {
  /** Absolute path to the generated .webm file. */
  outputPath: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  seed: number;
  durationMs: number;
}

export interface SdVideoGenerateCompleteEvent {
  requestId: string;
  result: SdVideoResultIpc;
}

export interface SdVideoGenerateErrorEvent {
  requestId: string;
  error: string;
  /** Classified sd-cli failure code (corrupt-model, out-of-memory, …). */
  code?: string;
  /** Raw sd-cli output tail for the expandable "Details". */
  details?: string;
}

export interface SdVideoCancelRequest {
  requestId: string;
}

export interface SdVideoCancelResponse {
  success: boolean;
}
