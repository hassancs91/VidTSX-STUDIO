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
