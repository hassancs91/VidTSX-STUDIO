// T8 "Check this export" (END_TO_END_PLAN §2, A6): the user-facing A/V sync
// check of a finished Studio export against the first camera clip's file.
// One check runs at a time in main; progress is pushed per probe; the report
// JSON is written beside the export (`<name>.sync.json`).

import type { SyncVerdict } from '../../studio/sync-verdict';

/**
 * Which document the export was made from.
 * - `entry`: a queue row — the Remotion entry path (`job.filePath`); main reads
 *   the range-trimmed document from the entry's sidecar (swept 24 h after the
 *   export, then the check says so).
 * - `project`: a saved project, trimmed to the I→O range when both are given
 *   (the CURRENT document — edits made after the export change the answer).
 */
export type StudioSyncCheckSource =
  | { kind: 'entry'; entryPath: string }
  | { kind: 'project'; projectId: string; rangeIn?: number; rangeOut?: number };

export interface StudioSyncCheckRequest {
  /** The finished export (absolute path). */
  exportPath: string;
  source: StudioSyncCheckSource;
}

export interface StudioSyncCheckResponse {
  success: boolean;
  error?: string;
  /** Another check is running (one at a time). */
  busy?: boolean;
  /** The check was cancelled before it finished. */
  cancelled?: boolean;
  verdict?: SyncVerdict;
  /** Where the report JSON was written. */
  reportPath?: string;
  /** Probes that found the camera picture confidently, of those attempted. */
  probes?: { confident: number; total: number };
  elapsedMs?: number;
}

export interface StudioSyncCheckCancelRequest {
  /** Cancel only the check of this file; omitted = whatever is running. */
  exportPath?: string;
}

export interface StudioSyncCheckCancelResponse {
  success: boolean;
  /** A running check was asked to stop. */
  cancelled: boolean;
  error?: string;
}

/** Push event (`studio:export:sync-check:progress`): probes done of total. */
export interface StudioSyncCheckProgressEvent {
  exportPath: string;
  done: number;
  total: number;
}
