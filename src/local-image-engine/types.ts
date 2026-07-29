/**
 * `flux` split into `flux1` / `flux2` (D5): the two generations need different
 * sd-cli invocations (FLUX.1 → clip_l + t5xxl + vae; FLUX.2 → llm + vae), which
 * drives required companions, preflight errors, and get-this-file links.
 */
export type SdModelFamily = 'sd15' | 'sdxl' | 'sd3' | 'flux1' | 'flux2';

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

/** A companion file a model needs at generation time (Flux text encoders / VAE). */
export interface CompanionRequirement {
  kind: 'vae' | 'llm' | 'clip_l' | 't5xxl';
  /** Accepted canonical filenames, e.g. ['ae.safetensors']. First is the preferred name. */
  fileNames: string[];
  /** Where to obtain this file (HF page) — used for the manual "Get ↗" fallback. */
  sourceUrl: string;
  sizeLabel: string;
  /**
   * Optional stable, public, unauthenticated direct URL for the preferred
   * filename (D1) → lets the model download fetch this companion in one click.
   * When absent, the companion stays a manual "Get ↗" link (e.g. a gated host).
   */
  downloadUrl?: string;
  /** Exact size of the `downloadUrl` file, for display/progress. */
  sizeBytes?: number;
}

/**
 * Category payload nested under `ModelProfileEnvelope<SdModelMeta>.meta`. Holds
 * everything sd-cli needs beyond the file path itself.
 */
export interface SdModelMeta {
  family: SdModelFamily;
  defaults: SdGenerationDefaults;
  capabilities: SdModelCapabilities;
  /** Use --diffusion-model instead of -m (diffusion-model-only Flux/SD3 GGUFs). */
  useDiffusionModelFlag?: boolean;
  /** Companion files required at generation time (Flux). */
  companions?: CompanionRequirement[];
  /**
   * All-in-one checkpoint (bundled text encoders + VAE): switches to `-m` and
   * clears companion requirements. Set via the Set-up dialog for Civitai FLUX.1
   * checkpoints (§6.2). Overrides `useDiffusionModelFlag`/`companions`.
   */
  allInOne?: boolean;
}

/** Fully resolved, engine-consumable invocation data (absolute paths). */
export interface ResolvedSdModel {
  modelId: string;
  modelFilePath: string;
  family: SdModelFamily;
  defaults: SdGenerationDefaults;
  capabilities: SdModelCapabilities;
  useDiffusionModelFlag?: boolean;
  allInOne?: boolean;
  /** Absolute paths to resolved companion files (only those the family needs). */
  companionPaths: {
    vae?: string;
    llm?: string;
    clipL?: string;
    t5xxl?: string;
  };
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
  /**
   * Present for promise-based callers (`enqueueAwait`): settles when the item
   * completes, fails, or is cancelled. Event-based callers leave it unset.
   */
  settle?: {
    resolve: (result: SdGenerationResult) => void;
    reject: (error: Error) => void;
  };
}
