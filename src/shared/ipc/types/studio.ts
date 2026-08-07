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
