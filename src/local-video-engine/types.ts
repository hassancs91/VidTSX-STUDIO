/**
 * Local video engine types (Wan / LTX via stable-diffusion.cpp).
 *
 * The video category is the second adapter on the category-agnostic
 * model-library core (see docs/local-image-models-redesign.md §3.4). It reuses
 * the sd-cli runtime family: video diffusion models are single GGUF/safetensors
 * files with companion files (text encoder + VAE), exactly like Flux images.
 *
 * Generation types are declared ahead of the runner: sd-cli video generation
 * requires a newer stable-diffusion.cpp build than the bundled one (backlog
 * item A6), so this session ships the model library only.
 */

export type VideoModelFamily = 'wan21' | 'wan22' | 'ltx' | 'lingbot';

export interface VideoGenerationDefaults {
  width: number;
  height: number;
  /** Number of frames to generate (Wan: 4n+1). */
  frames: number;
  fps: number;
  steps: number;
  cfgScale: number;
  sampler: string;
}

export interface VideoModelCapabilities {
  /** Supports text-to-video generation */
  t2v: boolean;
  /** Supports image-to-video generation */
  i2v: boolean;
}

/**
 * A companion file a video model needs at generation time.
 * Wan: umt5 encoder (`t5xxl`) + `vae`, I2V additionally `clip_vision`.
 * LTX-2.3: gemma LLM encoder (`llm`) + `vae` + `audio_vae` + `embeddings` connectors.
 */
export interface VideoCompanionRequirement {
  kind: 'vae' | 't5xxl' | 'clip_vision' | 'llm' | 'audio_vae' | 'embeddings';
  /** Accepted canonical filenames. First is the preferred name. */
  fileNames: string[];
  /** Where to obtain this file (HF page). */
  sourceUrl: string;
  sizeLabel: string;
  /**
   * Optional stable, public, unauthenticated direct URL for the preferred
   * filename (D1) → enables downloading companions together with the model.
   */
  downloadUrl?: string;
  /** Exact size of the `downloadUrl` file, for display/progress. */
  sizeBytes?: number;
}

/**
 * Category payload nested under `ModelProfileEnvelope<VideoModelMeta>.meta`.
 * Holds everything the (future) sd-cli video runner needs beyond the file path.
 */
export interface VideoModelMeta {
  family: VideoModelFamily;
  defaults: VideoGenerationDefaults;
  capabilities: VideoModelCapabilities;
  /** Use --diffusion-model instead of -m (diffusion-model-only GGUFs). */
  useDiffusionModelFlag?: boolean;
  /** Companion files required at generation time. */
  companions?: VideoCompanionRequirement[];
}

/** Fully resolved, engine-consumable invocation data (absolute paths). */
export interface ResolvedVideoModel {
  modelId: string;
  modelFilePath: string;
  family: VideoModelFamily;
  defaults: VideoGenerationDefaults;
  capabilities: VideoModelCapabilities;
  useDiffusionModelFlag?: boolean;
  /** Absolute paths to resolved companion files. */
  companionPaths: {
    vae?: string;
    t5xxl?: string;
    clipVision?: string;
    llm?: string;
    audioVae?: string;
    embeddings?: string;
  };
}

export interface VideoDownloadProgress {
  modelId: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  /** Which file of the set is downloading (e.g. "Text encoder"). */
  fileLabel?: string;
}

// ─── Generation ────────────────────────────────────────────────────

export interface VideoGenerationRequest {
  /** Which installed model to use (required — video has no active-model concept). */
  modelId: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  /** Number of frames (families have alignment rules, e.g. Wan 4n+1). */
  frames?: number;
  fps?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  sampler?: string;
  /** For image-to-video: absolute path to the first frame. */
  initImagePath?: string;
  /** Offload model weights to CPU/RAM to save VRAM (slower). */
  offloadToCpu?: boolean;
  /**
   * Run the text encoder on the CPU (`--clip-on-cpu`). Wan's umt5-xxl expands
   * to ~5.9 GB in memory — more than a 6 GB card holds beside the model —
   * so the out-of-memory retry turns this on with the two flags around it.
   */
  clipOnCpu?: boolean;
  /** Run the VAE on the CPU (`--vae-on-cpu`). */
  vaeOnCpu?: boolean;
}

export interface VideoGenerationResult {
  /** Absolute path to the generated .webm file. */
  outputPath: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  seed: number;
  durationMs: number;
}

export interface VideoGenerationProgress {
  requestId: string;
  step: number;
  totalSteps: number;
  percent: number;
}

export type VideoRequestStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface VideoQueueItem {
  requestId: string;
  request: VideoGenerationRequest;
  status: VideoRequestStatus;
}
