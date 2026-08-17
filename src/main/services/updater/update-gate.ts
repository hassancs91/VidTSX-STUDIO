/**
 * "Is the app busy?" gate for auto-update restarts.
 *
 * VidTSX runs long jobs that must never be killed by an installer — Remotion
 * renders, TSX generation, multi-GB model downloads. This module answers whether
 * restarting right now would destroy work, and returns plain sentences the UI can
 * show verbatim ("1 render in progress").
 *
 * Every subsystem is queried through a dynamic import inside try/catch: the gate
 * must never be the reason an update path throws, and a subsystem that fails to
 * load simply contributes no blockers.
 */

import { logEngine } from '../../../logging/log-engine';

/** Job states that mean real work is in flight. */
const ACTIVE_TSX_JOB_STATUSES = new Set(['queued', 'planning', 'generating', 'verifying', 'fixing', 'naming', 'saving']);
const ACTIVE_DOWNLOAD_STATUSES = new Set(['queued', 'downloading', 'extracting', 'verifying']);

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

async function countActiveRenders(): Promise<number> {
  const { getActiveJobs } = await import('../remotion-renderer');
  // The active-render map is emptied when a render settles, so its size *is* the
  // in-flight count. A just-cancelled render may linger for a tick — counting it
  // errs toward blocking, which is the safe direction.
  return getActiveJobs().length;
}

async function countActiveTsxJobs(): Promise<number> {
  const { tsxJobEngine } = await import('../tsx-jobs/tsx-job-engine');
  return tsxJobEngine.list().filter((job) => ACTIVE_TSX_JOB_STATUSES.has(job.status)).length;
}

async function countActiveDownloads(): Promise<number> {
  const { getAllDownloads } = await import('../download-manager');
  return getAllDownloads().filter((download) => ACTIVE_DOWNLOAD_STATUSES.has(download.status)).length;
}

/**
 * Collects reasons a restart would interrupt the user. Empty array = safe to restart.
 *
 * Note: Studio proxy/waveform jobs are deliberately not counted. They are seconds
 * long and re-derive themselves from source media on next launch, so blocking an
 * update on them would cost more than it saves.
 */
export async function getUpdateBlockers(): Promise<string[]> {
  const probes: Array<{ label: string; run: () => Promise<number> }> = [
    { label: 'render', run: countActiveRenders },
    { label: 'AI generation job', run: countActiveTsxJobs },
    { label: 'download', run: countActiveDownloads },
  ];

  const blockers: string[] = [];
  for (const probe of probes) {
    try {
      const count = await probe.run();
      if (count > 0) blockers.push(`${plural(count, probe.label)} in progress`);
    } catch (error) {
      // A probe that cannot load tells us nothing — treat as "not busy" rather
      // than blocking updates forever on an unrelated failure.
      logEngine.warn('Updater', `Busy-gate probe "${probe.label}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return blockers;
}
