import type { ProviderKeyId } from '../shared/providers/registry';

/** Provider identifier for image generation services */
export type ImageProviderId = string;

/** Supported image generation operations */
export type ImageOperation = 'text-to-image' | 'image-to-image' | 'multi-reference';

/** What the caller passes to generate images */
export interface ImageGenerationRequest {
  operation: ImageOperation;
  prompt: string;
  model?: string;              // override provider default model id
  width?: number;              // default: 1024
  height?: number;             // default: 1024
  numImages?: number;          // default: 1
  sourceImage?: string;        // base64, required for image-to-image
  referenceImages?: string[];  // base64[], required for multi-reference
  outputFormat?: 'png' | 'jpeg' | 'webp';
  // Optional abort signal threaded through into the provider's fetch calls.
  // The IPC handler creates a controller per callId; renderer-side AbortSignal
  // can't cross the IPC boundary so this field is main-only.
  signal?: AbortSignal;
}

/** A single generated image */
export interface GeneratedImage {
  base64: string;
  width: number;
  height: number;
  contentType: string;
}

/** What the caller gets back */
export interface ImageGenerationResponse {
  images: GeneratedImage[];
  model: string;
  provider: ImageProviderId;
  durationMs: number;
}

/** Metadata about a supported model */
export interface ImageModelInfo {
  id: string;
  name: string;
  supportedOperations: ImageOperation[];
  endpoints: Partial<Record<ImageOperation, string>>;
  /** Credit cost per generation, when the provider charges credits (VidTSX). */
  credits?: number;
}

/** Provider configuration stored in user settings */
export interface ImageProviderConfig {
  id: ImageProviderId;
  name: string;
  /**
   * 'local' is the on-device sd-cli bridge; 'gemini-cli' the Antigravity
   * (Google subscription) bridge; 'minimax-cli' reserved for the deferred mmx
   * provider. All three are registered directly, never stored in settings.
   */
  type: 'fal' | 'openrouter' | 'cloudflare' | 'local' | 'gemini-cli' | 'minimax-cli';
  apiKey: string;
  /**
   * Cloudflare only: the account id half of the credential pair. Not a secret
   * — injected at registration time from its plain settings field, never
   * persisted inside imageProviders.
   */
  accountId?: string;
  defaultModel: string;
  enabled: boolean;
  /**
   * Model catalog this provider serves (user-editable, from the provider-models
   * store). Omitted → the provider falls back to its built-in defaults.
   */
  models?: import('../shared/presets/image-models').ImageModelCatalogEntry[];
}

/**
 * A built-in cloud provider definition: the shared BYOK credential that
 * unlocks it (one key per provider, entered once in Providers). Instance
 * providers (local sd-cli, CLI bridges) have no preset.
 */
export interface ImageProviderPreset extends ImageProviderConfig {
  credentialId: ProviderKeyId;
}

/** The interface every image provider must implement */
export interface ImageProvider {
  readonly id: ImageProviderId;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
  getSupportedModels(): ImageModelInfo[];
}

/**
 * Content Safety Gate B hook, injected by main at init (the classifier needs
 * Electron/worker infrastructure this module must not import). The engine is
 * fail-closed: with no guard installed, generation refuses to run.
 */
export interface ImageSafetyGuard {
  /** Throws (ModerationBlockedError or fail-closed Error) to block. */
  checkImage(base64: string, context: 'input' | 'output'): Promise<void>;
  /** Observer for Gate A trips at the engine chokepoint (local counters). */
  onPromptBlocked?(category: string): void;
}

/** Typed error thrown by image providers */
export class ImageEngineError extends Error {
  constructor(
    message: string,
    public readonly provider: ImageProviderId,
    public readonly statusCode?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ImageEngineError';
  }
}
