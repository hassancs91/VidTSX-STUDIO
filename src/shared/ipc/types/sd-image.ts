// ─── Local SD Image Engine types ───
export interface SdImageStatusResponse {
  sdCliInstalled: boolean;
  sdCliVersion?: string;
  activeModelId: string | null;
}

export interface SdImageModelIpc {
  id: string;
  name: string;
  family: string;
  sizeLabel: string;
  sizeBytes: number;
  downloaded: boolean;
  defaults: {
    width: number;
    height: number;
    steps: number;
    cfgScale: number;
    sampler: string;
  };
  capabilities: {
    txt2img: boolean;
    img2img: boolean;
    reference: boolean;
  };
}

export interface SdImageModelsListResponse {
  models: SdImageModelIpc[];
}

export interface SdImageModelDownloadRequest {
  modelId: string;
}

export interface SdImageModelDownloadResponse {
  success: boolean;
  error?: string;
}

export interface SdImageModelDeleteRequest {
  modelId: string;
}

export interface SdImageModelDeleteResponse {
  success: boolean;
  error?: string;
}

export interface SdImageDownloadProgressEvent {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface SdImageCliStatusResponse {
  installed: boolean;
  version?: string;
  path?: string;
}

export interface SdImageSetActiveModelRequest {
  modelId: string;
}

export interface SdImageSetActiveModelResponse {
  success: boolean;
  error?: string;
}

export interface SdImageGenerateRequest {
  operation: 'txt2img' | 'img2img';
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  sourceImagePath?: string;
  strength?: number;
  modelId?: string;
  outputFormat?: 'png' | 'jpeg';
  schedule?: string;
  offloadToCpu?: boolean;
  clipOnCpu?: boolean;
  vaeOnCpu?: boolean;
  threads?: number;
  vaePath?: string;
  loraPath?: string;
  loraMultiplier?: number;
  batchCount?: number;
}

export interface SdImageGenerateResponse {
  success: boolean;
  requestId?: string;
  error?: string;
  /** Set when the preflight auto-enabled CPU offload because the model is over VRAM. */
  autoOffloadEnabled?: boolean;
}

export interface SdImageGenerateProgressEvent {
  requestId: string;
  step: number;
  totalSteps: number;
  percent: number;
}

export interface SdImageGenerateCompleteEvent {
  requestId: string;
  result: {
    outputPath: string;
    imageBase64: string;
    width: number;
    height: number;
    seed: number;
    durationMs: number;
  };
}

export interface SdImageGenerateErrorEvent {
  requestId: string;
  error: string;
}

export interface SdImageCancelRequest {
  requestId: string;
}

export interface SdImageCancelResponse {
  success: boolean;
}

export interface SdImageCancelAllResponse {
  success: boolean;
}

export interface SdImageQueueGetResponse {
  items: Array<{
    requestId: string;
    status: string;
    prompt: string;
  }>;
}

export interface SdImageSettingsGetResponse {
  activeModelId: string | null;
}

export interface SdImageSettingsSaveRequest {
  activeModelId?: string;
}

export interface SdImageSettingsSaveResponse {
  success: boolean;
  error?: string;
}
