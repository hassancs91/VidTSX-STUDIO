/** Supported archive extraction formats */
export type ExtractionFormat = 'zip' | 'tar' | 'tar.bz2' | 'tar.gz' | 'none';

/** Lifecycle states of a download task */
export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'extracting'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Options passed when enqueuing a download */
export interface DownloadOptions {
  /** Unique ID for this download (e.g. "whisper-binary", "llm-model-phi3") */
  id: string;
  /** Source URL */
  url: string;
  /** Absolute path to write the downloaded file */
  destPath: string;
  /** Optional SHA-256 hex digest for integrity verification */
  sha256?: string;
  /** Post-download extraction config */
  extraction?: {
    format: ExtractionFormat;
    /** Directory to extract into */
    destDir: string;
    /** Delete archive after successful extraction (default true) */
    deleteArchive?: boolean;
  };
  /** Arbitrary metadata the caller can attach (e.g. modelId, engineType) */
  metadata?: Record<string, string>;
  /** Lower number = higher priority. Default 0 */
  priority?: number;
}

/** Real-time progress snapshot */
export interface DownloadProgress {
  id: string;
  status: DownloadStatus;
  downloadedBytes: number;
  totalBytes: number;
  /** 0-100, or -1 if totalBytes unknown */
  percent: number;
  /** Bytes per second (smoothed) */
  speedBps: number;
  /** Estimated seconds remaining, -1 if unknown */
  etaSeconds: number;
  error?: string;
  metadata?: Record<string, string>;
}

/** Serializable state for persistence across app restarts */
export interface DownloadTaskState {
  options: DownloadOptions;
  status: DownloadStatus;
  downloadedBytes: number;
  totalBytes: number;
  /** ISO timestamp of last activity */
  updatedAt: string;
  /** Number of retry attempts so far */
  retryCount: number;
  lastError?: string;
}

/** Internal runtime task (not persisted — includes live handles) */
export interface DownloadTask {
  state: DownloadTaskState;
  /** Used to abort/pause the HTTP request */
  request: import('http').ClientRequest | null;
  /** Per-task progress callbacks from calling services */
  progressCallbacks: Set<(progress: DownloadProgress) => void>;
  /** Deferred promise controls for the enqueue caller */
  deferred: {
    resolve: () => void;
    reject: (err: Error) => void;
  } | null;
  /** Retry timeout handle */
  retryTimer: ReturnType<typeof setTimeout> | null;
}

/** Engine configuration */
export interface DownloadEngineConfig {
  /** Max concurrent active downloads (default 2) */
  maxConcurrent: number;
  /** Max auto-retry attempts per task (default 3) */
  maxRetries: number;
  /** Base delay for exponential backoff in ms (default 2000) */
  retryBaseDelayMs: number;
  /** Max redirects to follow (default 5) */
  maxRedirects: number;
}
