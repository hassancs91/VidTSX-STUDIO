// ─── Thumbnail operations ───
export interface ThumbnailReadRequest {
  tsxFilePath: string;
}

export interface ThumbnailReadResponse {
  data: string;
  exists: boolean;
  error?: string;
}

export interface ThumbnailReadyEvent {
  jobId: string;
  tsxFilePath: string;
  thumbnailPath: string;
}
