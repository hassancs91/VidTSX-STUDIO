import type {
  StudioAssetTranscriptMeta,
  StudioMediaAsset,
  StudioProject,
} from '../../types/studio';
import type { CutPlanStyleName, StudioCutPlan } from '../../types/studio-cut-plan';

// Studio (AI video editor) — projects & media IPC contracts.

export interface StudioProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  folderPath: string;
}

export interface StudioRootGetResponse {
  root: string;
}

export interface StudioRootSetRequest {
  root: string;
}

export interface StudioRootSetResponse {
  success: boolean;
  error?: string;
}

export interface StudioProjectListResponse {
  success: boolean;
  projects?: StudioProjectSummary[];
  root?: string;
  error?: string;
}

export interface StudioProjectCreateRequest {
  name: string;
  width: number;
  height: number;
  fps: number;
}

export interface StudioProjectCreateResponse {
  success: boolean;
  project?: StudioProject;
  error?: string;
}

export interface StudioProjectLoadRequest {
  id: string;
}

export interface StudioProjectLoadResponse {
  success: boolean;
  project?: StudioProject;
  /** Absolute project folder — the renderer builds cache/proxy URLs from it. */
  folderPath?: string;
  error?: string;
}

export interface StudioProjectSaveRequest {
  project: StudioProject;
}

export interface StudioProjectSaveResponse {
  success: boolean;
  updatedAt?: string;
  error?: string;
}

export interface StudioProjectDeleteRequest {
  id: string;
}

export interface StudioProjectDeleteResponse {
  success: boolean;
  error?: string;
}

export interface StudioMediaImportRequest {
  projectId: string;
}

export interface StudioMediaImportResponse {
  success: boolean;
  canceled?: boolean;
  /** Newly imported assets — the renderer merges them into the document. */
  assets?: StudioMediaAsset[];
  /** Per-file failures (unsupported type, probe error). */
  errors?: string[];
  error?: string;
}

export interface StudioCacheReadRequest {
  projectId: string;
  /** Path relative to the project's cache/ folder (e.g. "thumbs/<id>.jpg"). */
  relPath: string;
}

export interface StudioCacheReadResponse {
  success: boolean;
  /** Base64-encoded file contents. */
  data?: string;
  mime?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Timeline preview, background media jobs, export
// ---------------------------------------------------------------------------

/**
 * Derived caches an asset can have. Proxies/waveforms are requested
 * automatically on open; transcripts ONLY by an explicit user action.
 */
export type StudioMediaJobKind = 'proxy' | 'waveform' | 'transcript';

export interface StudioMediaJobEvent {
  projectId: string;
  assetId: string;
  kind: StudioMediaJobKind;
  /** 'canceled' is only emitted for explicit per-job cancels (transcripts). */
  status: 'generating' | 'ready' | 'error' | 'canceled';
  /** Cache-relative path, present when status is 'ready'. */
  relPath?: string;
  /** 0..100 — long jobs (transcription) stream progress while 'generating'. */
  percent?: number;
  /** Human-readable progress detail ("Uploading audio…"). */
  message?: string;
  /** Transcript jobs: document-ready metadata, present when 'ready'. */
  transcript?: StudioAssetTranscriptMeta;
  error?: string;
}

export interface StudioMediaPrepareRequest {
  projectId: string;
  assets: Array<{
    id: string;
    kind: 'video' | 'audio' | 'image';
    path: string;
    /** Silent sources get no waveform job — ffmpeg would just fail on them. */
    hasAudio: boolean;
  }>;
}

export interface StudioMediaPrepareResponse {
  success: boolean;
  /** Caches that already existed on disk — applied without waiting for events. */
  ready?: StudioMediaJobEvent[];
  /** Base URL of the local asset server the preview loads media through. */
  assetBaseUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Per-asset transcription (button-triggered) + auto-cut planning
// ---------------------------------------------------------------------------

export interface StudioTranscribeStartRequest {
  projectId: string;
  assetId: string;
  /** Absolute path of the source media (video or audio). */
  sourcePath: string;
  /** STT catalog id (e.g. 'local-whisper/base', 'assemblyai/universal'). */
  sttModelId: string;
}

export interface StudioTranscribeStartResponse {
  success: boolean;
  /** Fast-fail reasons (unknown model, provider not configured). */
  error?: string;
}

export interface StudioTranscribeCancelRequest {
  projectId: string;
  assetId: string;
}

export interface StudioTranscribeCancelResponse {
  success: boolean;
}

export interface StudioCutPlanRunRequest {
  projectId: string;
  assetId: string;
  /** Absolute source path — needed if the RMS envelope must be regenerated. */
  sourcePath: string;
  style?: CutPlanStyleName;
}

export interface StudioCutPlanRunResponse {
  success: boolean;
  plan?: StudioCutPlan;
  /** Absolute path of the written plan JSON, for external inspection. */
  planPath?: string;
  error?: string;
}

export interface StudioExportPrepareRequest {
  project: StudioProject;
}

export interface StudioExportPrepareResponse {
  success: boolean;
  /** Generated Remotion entry to hand to the render queue. */
  entryPath?: string;
  compositionId?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
  error?: string;
}
