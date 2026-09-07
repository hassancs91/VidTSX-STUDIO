import type { ProviderKeyId } from '../shared/providers/registry';
import type { AiFeatureSource } from '../shared/types/ai-usage';
import type { ContentSafetyBlockInfo } from '../shared/content-safety';
import type { VideoStudioEntry } from '../shared/ipc/types/video-studio';
import type {
  VideoDialectId,
  VideoModelCatalogEntry,
  VideoResolution,
} from '../shared/presets/video-models';

/** Provider identifier for video generation services */
export type VideoProviderId = string;

/**
 * An image a caller hands the engine: raw base64 (or a data URI), a local
 * file path (main-process callers), or an https URL. The engine resolves
 * paths to bytes before any gate or provider sees them.
 */
export interface MediaInput {
  kind: 'base64' | 'path' | 'url';
  value: string;
  contentType?: string;
}

/** Media as a provider receives it: bytes or a fetchable URL, never a path. */
export interface ProviderMediaInput {
  kind: 'base64' | 'url';
  value: string;
  contentType?: string;
}

/** What every caller passes; the engine normalizes it against the model. */
export interface VideoGenerationRequest {
  /** Default: the active video provider. */
  providerId?: VideoProviderId;
  /** Catalog model id (unknown ids fall back to the provider's default). */
  model: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  resolution?: VideoResolution;
  generateAudio?: boolean;
  seed?: number;
  firstFrame?: MediaInput;
  lastFrame?: MediaInput;
  /** Reference inputs (Seedance 2 reference-to-video; wired in Stage 3). */
  references?: { images?: MediaInput[]; videos?: MediaInput[]; audios?: MediaInput[] };
  /** Video Studio folder the finished clip is filed into. */
  folderId?: string | null;
  /** Which surface submitted the job — the usage log's featureSource. */
  featureSource?: AiFeatureSource;
  /** Main-process callers only: aborts the submit request and the job. */
  signal?: AbortSignal;
}

/** The normalized request a provider receives (every field resolved). */
export interface VideoProviderRequest {
  model: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution?: VideoResolution;
  generateAudio: boolean;
  seed?: number;
  firstFrame?: ProviderMediaInput;
  lastFrame?: ProviderMediaInput;
  referenceImages?: ProviderMediaInput[];
  /** Reference clips, already hosted where the provider can fetch them. */
  referenceVideos?: ProviderMediaInput[];
  referenceAudios?: ProviderMediaInput[];
  signal?: AbortSignal;
}

export type VideoDurationSpec =
  | { kind: 'discrete'; values: number[] }
  | { kind: 'range'; min: number; max: number; auto?: boolean };

/** Capabilities of a model, so pickers narrow themselves and the engine clamps. */
export interface VideoModelInfo {
  id: string;
  name: string;
  tagline?: string;
  dialect: VideoDialectId;
  durations: VideoDurationSpec;
  aspectRatios: string[];
  resolutions?: VideoResolution[];
  supports: {
    audio: boolean;
    firstFrame: boolean;
    lastFrame: boolean;
    references?: { images: number; videos: number; audios: number };
  };
  pricePerSecondUsd?: number;
  /** Per-resolution rates, where the provider publishes them. */
  pricePerSecondByResolutionUsd?: Partial<Record<VideoResolution, number>>;
}

/** Provider-reported spend, when the API returns one (BytePlus tokens). */
export interface VideoProviderUsage {
  completionTokens?: number;
}

export type VideoPollResult =
  | { status: 'pending' | 'running' }
  | { status: 'completed'; url: string; contentType?: string; usage?: VideoProviderUsage }
  | { status: 'failed'; error: string };

/** The interface every video provider implements — async, so submit + poll. */
export interface VideoProvider {
  readonly id: VideoProviderId;
  submit(request: VideoProviderRequest): Promise<{ providerJobId: string }>;
  poll(providerJobId: string, signal?: AbortSignal): Promise<VideoPollResult>;
  cancel?(providerJobId: string): Promise<void>;
  getSupportedModels(): VideoModelInfo[];
  /**
   * Host local bytes somewhere this provider can fetch them, for reference
   * media too large to inline (video everywhere, audio on fal). Absent means
   * the provider takes reference media inline only.
   */
  uploadMedia?(
    input: ProviderMediaInput,
    kind: 'video' | 'audio',
    signal?: AbortSignal,
  ): Promise<ProviderMediaInput>;
}

/** Provider configuration (one entry per cloud provider). */
export interface VideoProviderConfig {
  id: VideoProviderId;
  name: string;
  type: 'fal' | 'byteplus';
  apiKey: string;
  defaultModel: string;
  enabled: boolean;
  /** Model catalog this provider serves; omitted → built-in defaults. */
  models?: VideoModelCatalogEntry[];
}

/** A built-in provider definition + the shared BYOK credential that unlocks it. */
export interface VideoProviderPreset extends VideoProviderConfig {
  credentialId: ProviderKeyId;
}

export type VideoJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** The request as recorded on a job: every field but the media bytes. */
export interface VideoJobRequestSummary {
  model: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution?: VideoResolution;
  generateAudio: boolean;
  seed?: number;
  hasFirstFrame: boolean;
  hasLastFrame: boolean;
  /** How many reference inputs of each kind the job carried. */
  referenceCounts?: { images: number; videos: number; audios: number };
  folderId?: string | null;
}

/** Where the gated clip landed — the local entry, never the remote URL. */
export interface VideoJobResult {
  entry: VideoStudioEntry;
  filePath: string;
}

/**
 * Plain-JSON job record (D5): in-memory for V1, shaped so persisting it and
 * resuming the poll on startup is a later add, not a redesign.
 */
export interface VideoJobRecord {
  jobId: string;
  providerId: VideoProviderId;
  providerJobId: string;
  featureSource: AiFeatureSource;
  request: VideoJobRequestSummary;
  submittedAt: number;
  updatedAt: number;
  status: VideoJobStatus;
  result?: VideoJobResult;
  error?: string;
  /** Set when Content Safety blocked the clip (error carries the copy). */
  blocked?: ContentSafetyBlockInfo;
}

export type VideoJobListener = (record: VideoJobRecord) => void;

/** What generateAndWait resolves with. */
export interface VideoGenerationResult extends VideoJobResult {
  jobId: string;
  provider: VideoProviderId;
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  hasAudio: boolean;
  durationMs: number;
}

/**
 * Content Safety Gate B hook for input images, injected by main at init (the
 * classifier needs Electron/worker infrastructure this module must not
 * import). Fail-closed: with no guard installed, submission refuses to run.
 */
export interface VideoSafetyGuard {
  /** Throws (ModerationBlockedError or fail-closed Error) to block. */
  checkImage(input: ProviderMediaInput, context: 'input'): Promise<void>;
  /**
   * Same for a reference video, over sampled frames. Absent means reference
   * videos cannot be gated, so the engine refuses them (fail-closed).
   */
  checkVideo?(input: ProviderMediaInput, context: 'input'): Promise<void>;
  /** Observer for Gate A trips at the engine chokepoint (local counters). */
  onPromptBlocked?(category: string): void;
}

export interface VideoClipStoreInput {
  url: string;
  contentType?: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  durationSeconds: number;
  hasAudio: boolean;
  folderId?: string | null;
  signal?: AbortSignal;
}

/**
 * The finishing step, injected by main: download the remote clip, run Gate B
 * on sampled frames, file it in Video Studio. Fail-closed like the guard —
 * without a store the engine refuses to submit, so no job can complete
 * ungated.
 */
export interface VideoClipStore {
  store(input: VideoClipStoreInput): Promise<VideoJobResult>;
}

export interface VideoUsageEntry {
  providerId: VideoProviderId;
  model: string;
  featureSource: AiFeatureSource;
  costUsd: number;
  durationMs: number;
  /** Provider-reported output tokens (BytePlus bills on these). */
  outputTokens?: number;
}

export type VideoUsageLogger = (entry: VideoUsageEntry) => void;

/** Typed error thrown by video providers */
export class VideoEngineError extends Error {
  constructor(
    message: string,
    public readonly provider: VideoProviderId,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VideoEngineError';
  }
}
