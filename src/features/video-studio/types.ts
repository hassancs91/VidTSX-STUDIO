import type { VideoStudioEntry, VideoStudioFolder } from '../../shared/ipc/types';
import type { VideoRouteMode } from '../../shared/video/types';

export interface GalleryVideo extends VideoStudioEntry {
  /** file:// URL to the video file on disk. */
  videoUrl: string;
  /** file:// URL to the JPEG thumbnail, or null if thumbnail extraction failed. */
  thumbnailUrl: string | null;
}

export interface GalleryFolder extends VideoStudioFolder {
  videoCount: number;
  /** Thumbnail URLs from the first up-to-4 videos in this folder. */
  coverThumbnailUrls: string[];
}

/** Which route the panel is composing — the engine treats these as exclusive.
 *  The Flows node narrows itself by the same three, so the type is shared. */
export type VideoPanelMode = VideoRouteMode;

/** What the control panel hands the generation hook. */
export interface VideoGenerationSettings {
  mode: VideoPanelMode;
  providerId: string;
  model: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: string;
  resolution?: string;
  generateAudio: boolean;
  /** Raw base64 image bytes, as ReferenceImageLibrary yields them. */
  firstFrame?: string;
  lastFrame?: string;
  referenceImages?: string[];
  /** Local paths, so the provider uploads the bytes rather than the renderer. */
  referenceVideoPaths?: string[];
  referenceAudioPaths?: string[];
}

/** The prompt/model a job card shows, kept renderer-side at submit time. */
export interface VideoJobSeed {
  prompt: string;
  model: string;
  providerId: string;
  durationSeconds: number;
}

/** One in-flight (or just-failed) job as the gallery renders it. */
export interface VideoJobView extends VideoJobSeed {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  submittedAt: number;
  error?: string;
  blocked?: import('../../shared/content-safety').ContentSafetyBlockInfo;
  /** A cancel is in flight; the push settles it. */
  cancelling?: boolean;
}
