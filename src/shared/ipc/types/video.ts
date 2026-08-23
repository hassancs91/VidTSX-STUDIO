/**
 * Video generation IPC types (fal.ai queue API, BYOK).
 * The renderer submits a job, receives a jobId, and polls until completion —
 * same shape the Flows generate-video node used with the removed VidTSX API.
 */

import type { ContentSafetyBlockInfo } from '../../content-safety/types';

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
}

export type VideoGenerateResponse =
  | { success: true; data: { jobId: string } }
  | {
      success: false;
      error: string;
      /** Set when Content Safety blocked the request (error carries the copy). */
      blocked?: ContentSafetyBlockInfo;
    };

export type VideoJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface VideoJobData {
  jobId: string;
  status: VideoJobStatus;
  videoUrl?: string;
  modelUsed?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  hasAudio?: boolean;
  error?: string;
}

export type VideoJobResponse =
  | { success: true; data: VideoJobData }
  | { success: false; error: string };
