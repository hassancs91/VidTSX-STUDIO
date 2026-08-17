/**
 * Auto-update contract shared by main, preload, and renderer.
 * See docs/auto-update-plan.md for the full flow.
 */

export type UpdaterStatus =
  /** Nothing known yet — no check has completed this session. */
  | 'idle'
  | 'checking'
  /** Checked, already on the newest version. */
  | 'not-available'
  /** A newer version exists but has not been downloaded. */
  | 'available'
  | 'downloading'
  /** Staged on disk, waiting for a restart. */
  | 'downloaded'
  | 'error'
  /** Dev build, unsigned macOS, or a fork built without a publish config. */
  | 'unsupported';

export type UpdateChannel = 'stable' | 'beta';

/** Whether the most recent check was a background poll or a user click. */
export type UpdateCheckTrigger = 'auto' | 'manual';

export interface UpdateDownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterState {
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion: string | null;
  /** Markdown release notes from the GitHub release body, normalized to one string. */
  releaseNotes: string | null;
  releaseDate: string | null;
  progress: UpdateDownloadProgress | null;
  /** Human-readable — never a raw stack trace. */
  error: string | null;
  lastCheckedAt: number | null;
  /**
   * Drives visibility: an `auto` check that finds nothing or fails stays silent,
   * a `manual` one always answers. See docs/auto-update-plan.md §5.1.
   */
  lastCheckTrigger: UpdateCheckTrigger;
  unsupportedReason: string | null;
  channel: UpdateChannel;
  autoDownload: boolean;
  /** True between "Restart & install" and the app actually quitting. */
  installing: boolean;
  /** Non-empty means a restart would interrupt work — see update-gate.ts. */
  blockers: string[];
  /** Version the user dismissed; suppresses automatic nagging only. */
  skippedVersion: string | null;
}

export interface UpdaterGetStateResponse {
  state: UpdaterState;
}

export interface UpdaterCheckRequest {
  /** Defaults to 'manual' — background polls pass 'auto' explicitly. */
  trigger?: UpdateCheckTrigger;
}

export interface UpdaterCheckResponse {
  success: boolean;
  state: UpdaterState;
  error?: string;
}

export interface UpdaterDownloadResponse {
  success: boolean;
  error?: string;
}

export interface UpdaterCancelResponse {
  success: boolean;
}

export type UpdaterInstallBlockedReason = 'busy' | 'not-ready' | 'unsupported';

export interface UpdaterInstallResponse {
  success: boolean;
  reason?: UpdaterInstallBlockedReason;
  /** Populated when reason is 'busy' — plain sentences to show the user. */
  blockers?: string[];
  error?: string;
}

export interface UpdaterSetPrefsRequest {
  autoDownload?: boolean;
  channel?: UpdateChannel;
  /** Pass the version string to skip it, or null to clear. */
  skipVersion?: string | null;
}

export interface UpdaterSetPrefsResponse {
  success: boolean;
  state: UpdaterState;
}

/** Push event — main sends the whole state on every transition. */
export interface UpdaterStateEvent {
  state: UpdaterState;
}
