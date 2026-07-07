// ─── Video Studio types ───

export interface VideoStudioFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface VideoStudioEntry {
  id: string;
  fileName: string;
  thumbnailFileName: string | null;
  prompt: string;
  model: string;
  aspectRatio: string | null;
  durationSeconds: number | null;
  hasAudio: boolean;
  sizeBytes: number | null;
  contentType: string;
  creditsConsumed: number | null;
  sourceUrl: string | null;
  createdAt: number;
  folderId: string | null;
}

export interface VideoStudioSaveRequest {
  /** Source URL to download from (e.g. the VidTSX S3 URL). */
  url: string;
  prompt: string;
  model: string;
  aspectRatio?: string;
  durationSeconds?: number;
  hasAudio?: boolean;
  creditsConsumed?: number;
  folderId?: string | null;
}

export interface VideoStudioSaveResponse {
  success: boolean;
  entry?: VideoStudioEntry;
  error?: string;
}

export interface VideoStudioListResponse {
  success: boolean;
  entries: VideoStudioEntry[];
  folders: VideoStudioFolder[];
  basePath: string;
  thumbnailsBasePath: string;
  error?: string;
}

export interface VideoStudioDeleteRequest {
  id: string;
}

export interface VideoStudioDeleteResponse {
  success: boolean;
  error?: string;
}

export interface VideoStudioSaveAsRequest {
  id: string;
}

export interface VideoStudioSaveAsResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface VideoStudioReadPathRequest {
  id: string;
}

export interface VideoStudioReadPathResponse {
  success: boolean;
  /** Absolute filesystem path to the video file. */
  filePath?: string;
  error?: string;
}

export interface VideoStudioFolderCreateRequest {
  name: string;
}

export interface VideoStudioFolderCreateResponse {
  success: boolean;
  folder?: VideoStudioFolder;
  error?: string;
}

export interface VideoStudioFolderRenameRequest {
  id: string;
  name: string;
}

export interface VideoStudioFolderRenameResponse {
  success: boolean;
  error?: string;
}

export interface VideoStudioFolderDeleteRequest {
  id: string;
  deleteVideos: boolean;
}

export interface VideoStudioFolderDeleteResponse {
  success: boolean;
  error?: string;
}

export interface VideoStudioMoveToFolderRequest {
  videoIds: string[];
  folderId: string | null;
}

export interface VideoStudioMoveToFolderResponse {
  success: boolean;
  error?: string;
}
