// Studio — optional GPU proxy encoder (Settings › Rendering). The full ffmpeg
// build is downloaded on request; the renderer only ever sees this status.

export type ProxyGpuEncoderId = 'nvenc' | 'qsv' | 'amf';

export interface StudioProxyEncoderStatusResponse {
  success: boolean;
  error?: string;
  /**
   * Effective state: the user's explicit choice, or — when they never chose —
   * on when viable (installed + NVENC working; A4). What the checkbox shows.
   */
  enabled: boolean;
  /** The persisted choice; null = never chosen, so `enabled` is automatic. */
  choice?: boolean | null;
  /** The full ffmpeg binary is on disk. */
  installed: boolean;
  /** A download/extract is in flight (also true across an app restart resume). */
  downloading: boolean;
  /** The download exists for this platform (the build is win64-only). Absent = older main. */
  downloadable?: boolean;
  /**
   * An NVIDIA adapter is present (Electron's GPU info, read before the full
   * ffmpeg exists); null = could not tell. Gates the first-4K-import card (A4).
   */
  nvidiaAdapter?: boolean | null;
  /** Zip size of the catalogue entry, for the "Download (~80 MB)" button. */
  downloadBytes: number;
  /** Version and licence shown beside the button. */
  version: string;
  licence: string;
  /** Encoder the next proxy would use, once installed; null = none works here. */
  detected: ProxyGpuEncoderId | null;
  detectedLabel: string | null;
  /** Every encoder the binary lists, whether or not it opened. */
  listed: ProxyGpuEncoderId[];
  /** Set when a GPU window failed this session and x264 took over. */
  fallback: { encoder: ProxyGpuEncoderId; reason: string; at: string } | null;
}

export interface StudioProxyEncoderInstallResponse {
  success: boolean;
  error?: string;
}

export interface StudioProxyEncoderSetEnabledRequest {
  enabled: boolean;
}

export interface StudioProxyEncoderSetEnabledResponse {
  success: boolean;
  error?: string;
}

/**
 * After the first-4K-import card's download (A4): the open project's 4K
 * videos. Main rebuilds the ones whose proxy this session is building (or
 * built) on x264 — the card's own clip included — on the GPU encoder.
 */
export interface StudioProxyEncoderRebuildRequest {
  projectId: string;
  assets: Array<{ assetId: string; path: string }>;
}

export interface StudioProxyEncoderRebuildResponse {
  success: boolean;
  error?: string;
  /** In-flight x264 builds aborted and queued again. */
  restarted: string[];
  /** Finished x264 proxies queued again. */
  rebuilt: string[];
}
