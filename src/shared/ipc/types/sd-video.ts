// ─── Local video models (Wan via sd-cli) IPC types ───
// The library view uses the generic MODELS_* channels (model-library.ts);
// only the one-click profile download is category-specific. Generation is
// the video engine's local provider (video.ts VIDEO_* channels).

export interface SdVideoModelDownloadRequest {
  modelId: string;
}

export interface SdVideoModelDownloadResponse {
  success: boolean;
  error?: string;
}
