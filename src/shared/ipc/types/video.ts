/**
 * Video generation IPC types (cloud providers behind src/video-engine, BYOK).
 * The renderer submits a job, receives a jobId, then polls `videoGetJob` or
 * subscribes to the `video:job-progress` push until the job is terminal.
 */

import type { ContentSafetyBlockInfo } from '../../content-safety/types';
import type { AiFeatureSource } from '../../types/ai-usage';
import type { VideoStudioEntry } from './video-studio';

/** Reference media a caller passes: base64 bytes, a local path, or a URL. */
export interface VideoMediaInputIpc {
  kind: 'base64' | 'path' | 'url';
  value: string;
  contentType?: string;
}

export interface VideoGenerateRequest {
  prompt: string;
  /** Catalog model id from @shared/presets/video-models. */
  model: string;
  durationSeconds: number;
  aspectRatio: string;
  generateAudio?: boolean;
  seed?: number;
  /** First/last frame: raw base64 image bytes or an https URL. */
  firstFrame?: string;
  lastFrame?: string;
  /** Video provider id; defaults to the active provider (fal). */
  providerId?: string;
  /** Video Studio folder the finished clip is filed into. */
  folderId?: string | null;
  /** Usage-log attribution; defaults to 'flows'. */
  featureSource?: AiFeatureSource;
  /** Output resolution, where the model has one. */
  resolution?: string;
  /**
   * Seedance omni references. Images may be base64; videos and audio are
   * uploaded by the provider first, so a path or URL is cheapest.
   */
  references?: {
    images?: VideoMediaInputIpc[];
    videos?: VideoMediaInputIpc[];
    audios?: VideoMediaInputIpc[];
  };
}

export interface VideoProviderInfo {
  id: string;
  name: string;
  /** True when this provider is the engine's current default. */
  isActive: boolean;
}

/** Capability view of one model, so pickers narrow themselves. */
export interface VideoModelInfoIpc {
  id: string;
  name: string;
  tagline?: string;
  durations:
    | { kind: 'discrete'; values: number[] }
    | { kind: 'range'; min: number; max: number; auto?: boolean };
  aspectRatios: string[];
  resolutions?: string[];
  supports: {
    audio: boolean;
    firstFrame: boolean;
    lastFrame: boolean;
    /** False where the model ignores a seed (both Seedance 2.x families). */
    seed: boolean;
    references?: { images: number; videos: number; audios: number };
  };
  pricePerSecondUsd?: number;
  /** Per-resolution rates, where the provider publishes them. */
  pricePerSecondByResolutionUsd?: Partial<Record<string, number>>;
}

export interface VideoProvidersGetResponse {
  success: boolean;
  providers: VideoProviderInfo[];
  activeProvider: string | null;
  error?: string;
}

export interface VideoModelsGetRequest {
  providerId?: string;
}

export interface VideoModelsGetResponse {
  success: boolean;
  models: VideoModelInfoIpc[];
  error?: string;
}

/** Providers-page "Test": proves the key works and generates nothing. */
export interface VideoProviderTestRequest {
  providerId: string;
  apiKey?: string;
}

export interface VideoProviderTestResponse {
  success: boolean;
  durationMs?: number;
  error?: string;
}

export type VideoGenerateResponse =
  | { success: true; data: { jobId: string } }
  | {
      success: false;
      error: string;
      /** Set when Content Safety blocked the request (error carries the copy). */
      blocked?: ContentSafetyBlockInfo;
    };

export type VideoJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface VideoJobData {
  jobId: string;
  status: VideoJobStatus;
  providerId?: string;
  /**
   * `file://` URL of the finished clip in Video Studio — the engine downloads
   * and gates every clip before it completes, so callers never hold a remote
   * URL.
   */
  videoUrl?: string;
  /** The Video Studio entry the clip was filed as. */
  entry?: VideoStudioEntry;
  modelUsed?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  hasAudio?: boolean;
  error?: string;
  /** Set when Content Safety blocked the clip (error carries the copy). */
  blocked?: ContentSafetyBlockInfo;
}

export type VideoJobResponse =
  | { success: true; data: VideoJobData }
  | { success: false; error: string };

/** Pushed on `video:job-progress` for every job state change. */
export type VideoJobProgressEvent = VideoJobData;

export interface VideoCancelRequest {
  jobId: string;
}

export interface VideoCancelResponse {
  success: boolean;
  error?: string;
}
