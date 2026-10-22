// "Check A/V" on a finished Studio export row (T8, END_TO_END_PLAN §2 / A6):
// which rows offer it, how main's answer becomes the row's state, and the
// lines the row shows. Pure — the hook does the IPC.

import type { RenderQueueJob, StudioSyncCheckResponse } from '@shared/ipc/types';
import type { SyncVerdict, SyncVerdictKind } from '@shared/studio/sync-verdict';
import type { SyncCheckState } from '../types';

const ENTRY_PREFIX = 'studio-entry-';

function baseName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * A finished Studio timeline export with sound. Studio rows are the ones the
 * editor's Export added: they always carry `exportEngine`, and their
 * `filePath` is the Remotion entry `studio-entry-<project>-<hash>.tsx`, whose
 * sidecar holds the exported document the check reads.
 */
export function isSyncCheckableJob(job: RenderQueueJob): boolean {
  if (job.status !== 'done' || job.muted) return false;
  if (job.exportEngine === undefined) return false;
  const base = baseName(job.filePath);
  return base.startsWith(ENTRY_PREFIX) && base.endsWith('.tsx');
}

/** Main's answer → the row's state (a cancelled check goes back to idle). */
export function syncCheckStateFromResponse(res: StudioSyncCheckResponse): SyncCheckState {
  if (res.success && res.verdict) {
    return {
      status: 'result',
      verdict: res.verdict,
      ...(res.reportPath ? { reportPath: res.reportPath } : {}),
      ...(res.probes ? { probes: res.probes } : {}),
      ...(res.elapsedMs !== undefined ? { elapsedMs: res.elapsedMs } : {}),
    };
  }
  if (res.cancelled) return { status: 'idle' };
  if (res.busy) {
    return { status: 'error', message: 'Another A/V check is running. Wait for it to finish, then try again.' };
  }
  return { status: 'error', message: res.error ?? 'The A/V check failed.' };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;
const signed = (v: number): string => `${v >= 0 ? '+' : ''}${r1(v)}`;

export interface SyncCheckSummary {
  tone: SyncVerdictKind;
  /** Short label for the coloured chip. */
  label: string;
  /** The verdict's one-line sentence. */
  message: string;
  /** "Offset +0.2 ms · drift -2.8 ms over 10.1 s · 16 of 16 probes confident · 52.6 s". */
  details: string;
}

const LABELS: Record<SyncVerdictKind, string> = {
  pass: 'In sync',
  fail: 'Out of sync',
  inconclusive: 'Not enough to judge',
};

export function summarizeSyncCheck(
  verdict: SyncVerdict,
  probes?: { confident: number; total: number },
  elapsedMs?: number,
): SyncCheckSummary {
  const parts: string[] = [];
  if (verdict.offsetMs !== null) parts.push(`Offset ${signed(verdict.offsetMs)} ms`);
  if (verdict.driftOverSpanMs !== null && verdict.spanSec !== null) {
    parts.push(`drift ${signed(verdict.driftOverSpanMs)} ms over ${r1(verdict.spanSec)} s`);
  }
  const confident = probes?.confident ?? verdict.confident;
  const total = probes?.total ?? verdict.attempted;
  parts.push(`${confident} of ${total} probes confident`);
  if (elapsedMs !== undefined) parts.push(`${r1(elapsedMs / 1000)} s`);
  return {
    tone: verdict.verdict,
    label: LABELS[verdict.verdict],
    message: verdict.message,
    details: parts.join(' · '),
  };
}

/** The running line: "Checking A/V… probe 3 of 16" (0 of 0 = still reading the export). */
export function syncCheckProgressText(done: number, total: number): string {
  if (total <= 0) return 'Checking A/V: reading the export…';
  return `Checking A/V: probe ${Math.min(done, total)} of ${total}`;
}
