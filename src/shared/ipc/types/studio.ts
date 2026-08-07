import type { StudioMediaAsset, StudioProject } from '../../types/studio';

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

/** Derived caches an asset needs before it plays well in the editor. */
export type StudioMediaJobKind = 'proxy' | 'waveform';

export interface StudioMediaJobEvent {
  projectId: string;
  assetId: string;
  kind: StudioMediaJobKind;
  status: 'generating' | 'ready' | 'error';
  /** Cache-relative path, present when status is 'ready'. */
  relPath?: string;
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
