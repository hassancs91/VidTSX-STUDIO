/**
 * Video generation IPC types (cloud providers behind src/video-engine, BYOK).
 * The renderer submits a job, receives a jobId, then polls `videoGetJob` or
 * subscribes to the `video:job-progress` push until the job is terminal.
 */

import type { ContentSafetyBlockInfo } from '../../content-safety/types';
import type { AiFeatureSource } from '../../types/ai-usage';
import type { VideoStudioEntry } from './video-studio';

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
