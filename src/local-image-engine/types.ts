export type SdModelFamily = 'sd15' | 'sdxl' | 'sd3' | 'flux';

export interface SdGenerationDefaults {
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
}

export interface SdModelCapabilities {
  /** Supports text-to-image generation */
  txt2img: boolean;
  /** Supports image-to-image editing */
  img2img: boolean;
  /** Supports reference/control image input */
  reference: boolean;
}

export interface SdModelDefinition {
  id: string;
  name: string;
  family: SdModelFamily;
  sizeBytes: number;
  sizeLabel: string;
  /** Relative path appended to SD_MODELS_BASE_URL for download */
  downloadPath: string;
  archiveFormat: 'tar.bz2' | 'tar.gz' | 'zip' | 'none';
  /** Name of the extracted dir (or file) inside userData/ai-models/image/ */
  extractedName: string;
  /** The model file name passed to sd-cli --model */
  modelFileName: string;
  defaults: SdGenerationDefaults;
  /** If true, model is excluded from the UI */
  hidden?: boolean;
  /** What generation modes this model supports */
  capabilities: SdModelCapabilities;
  /** Use --diffusion-model flag instead of -m (required for Flux/SD3 multi-file models) */
  useDiffusionModelFlag?: boolean;
  /** LLM text encoder file name (FLUX.2 Klein: passed via --llm) */
  llmEncoderFileName?: string;
  /** CLIP-L text encoder file name (passed via --clip_l) */
  clipLFileName?: string;
  /** T5-XXL text encoder file name (passed via --t5xxl) */
  t5xxlFileName?: string;
  /** VAE model file name (passed via --vae) */
  vaeFileName?: string;
}

// ─── Generation ────────────────────────────────────────────────────

export type SdOperation = 'txt2img' | 'img2img';

export interface SdGenerationRequest {
  operation: SdOperation;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  /** For img2img: absolute path to source image */
  sourceImagePath?: string;
  /** img2img denoising strength 0-1 */
  strength?: number;
  /** Override which model to use (defaults to active model) */
  modelId?: string;
  outputFormat?: 'png' | 'jpeg';
  /** Noise schedule: discrete, karras, exponential, ays, gits */
  schedule?: string;
  /** Offload model weights to CPU after each layer to save VRAM */
  offloadToCpu?: boolean;
  /** Clip-on-CPU: keep CLIP model on CPU */
  clipOnCpu?: boolean;
  /** VAE-on-CPU: keep VAE model on CPU */
  vaeOnCpu?: boolean;
  /** Number of threads for CPU inference */
  threads?: number;
  /** Path to a separate VAE model file */
  vaePath?: string;
  /** Path to a LoRA weights file */
  loraPath?: string;
  /** LoRA multiplier (default 1.0) */
  loraMultiplier?: number;
  /** Batch count: number of images to generate */
  batchCount?: number;
}

export interface SdGenerationResult {
  outputPath: string;
  imageBase64: string;
  width: number;
  height: number;
  seed: number;
  durationMs: number;
}

// ─── Progress ──────────────────────────────────────────────────────

export interface SdGenerationProgress {
  requestId: string;
  step: number;
  totalSteps: number;
  percent: number;
}

export interface SdDownloadProgress {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

// ─── Queue ─────────────────────────────────────────────────────────

export type SdRequestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SdQueueItem {
  requestId: string;
  request: SdGenerationRequest;
  status: SdRequestStatus;
}
