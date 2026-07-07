// ─── Download manager operations ───
export interface DownloadEnqueueRequest {
  id: string;
  url: string;
  destPath: string;
  sha256?: string;
  extraction?: {
    format: 'zip' | 'tar' | 'tar.bz2' | 'tar.gz' | 'none';
    destDir: string;
    deleteArchive?: boolean;
  };
  metadata?: Record<string, string>;
  priority?: number;
}

export interface DownloadEnqueueResponse {
  success: boolean;
  error?: string;
}

export interface DownloadControlRequest {
  id: string;
}

export interface DownloadControlResponse {
  success: boolean;
  error?: string;
}

export interface DownloadGetAllResponse {
  downloads: DownloadProgressEvent[];
}

export interface DownloadProgressEvent {
  id: string;
  status: string;
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBps: number;
  etaSeconds: number;
  error?: string;
  metadata?: Record<string, string>;
}
