// Which of the job engine's jobs the Creator shows where, and what a finished
// one does (P3 part 2). Pure: MotionScreen's hook (useCreatorJobs) holds the
// state and runs the side effects.
//
// - Jobs that agents, Studio or flows started (an `origin` other than the
//   Creator) are theirs: the Creator never lists, opens or toasts them.
// - A build is "watched" when the user started it here or clicked it; the
//   centre panel shows the watched build, else (nothing open) the newest one
//   running. A finished new build opens when nothing is open or when it was
//   watched — then it is what the user is looking at, so opening it steals
//   nothing. Otherwise it offers itself in a toast.

import type { TsxJobIpc } from '@shared/ipc/types';

const ACTIVE_STATUSES = new Set(['queued', 'planning', 'generating', 'verifying', 'fixing', 'naming', 'saving']);

export function isJobActive(job: TsxJobIpc): boolean {
  return ACTIVE_STATUSES.has(job.status);
}

export function isJobFinished(job: TsxJobIpc): boolean {
  return job.status === 'done' || job.status === 'error' || job.status === 'cancelled';
}

export function isCreatorJob(job: TsxJobIpc): boolean {
  return !job.origin || job.origin === 'creator';
}

/** A job that makes a new project (a generate, or a build that edits nothing). */
export function isNewProjectJob(job: TsxJobIpc): boolean {
  return job.kind === 'generate' || (job.kind === 'build' && !job.targetFolderPath);
}

/** Running jobs that will add a project: placeholder rows in the library. */
export function pendingProjectJobs(jobs: TsxJobIpc[]): TsxJobIpc[] {
  return jobs.filter((j) => isNewProjectJob(j) && isJobActive(j));
}

/** The open project's edit / fix in flight: it drives the preview's overlay. */
export function openProjectJob(jobs: TsxJobIpc[], openFolderPath: string | null): TsxJobIpc | null {
  if (!openFolderPath) return null;
  return jobs.find((j) =>
    (j.kind === 'edit' || j.kind === 'fix') && j.targetFolderPath === openFolderPath && isJobActive(j)) ?? null;
}

function newest(jobs: TsxJobIpc[]): TsxJobIpc | null {
  return [...jobs].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/** Which job streams into the preview panel: the open project's edit / fix, or (nothing open) the newest generation. */
export function previewStreamJob(jobs: TsxJobIpc[], openFolderPath: string | null): TsxJobIpc | null {
  return openProjectJob(jobs, openFolderPath)
    ?? (openFolderPath ? null : newest(jobs.filter((j) => j.kind === 'generate' && j.status === 'generating')));
}

/** The build the centre panel shows instead of the preview, if any. */
export function centreBuildJob(jobs: TsxJobIpc[], watchedJobId: string | null, openFolderPath: string | null): TsxJobIpc | null {
  const watched = watchedJobId ? jobs.find((j) => j.id === watchedJobId && j.kind === 'build') : undefined;
  if (watched) return watched;
  if (openFolderPath) return null;
  return newest(jobs.filter((j) => j.kind === 'build' && isNewProjectJob(j) && isJobActive(j)));
}

/** A queued build waits for the one build that may run at a time (D7): whose? */
export function waitingFor(job: TsxJobIpc, jobs: TsxJobIpc[], otherBuildActive: boolean): 'creator' | 'other' | null {
  if (job.kind !== 'build' || job.status !== 'queued') return null;
  if (jobs.some((j) => j.id !== job.id && j.kind === 'build' && isJobActive(j) && j.status !== 'queued')) return 'creator';
  return otherBuildActive ? 'other' : null;
}

export type JobOutcome =
  | { type: 'open'; versionPath: string; folderPath: string; notice?: string }
  | { type: 'offer'; message: string; versionPath: string; folderPath: string; notice?: string }
  | { type: 'error'; message: string }
  | { type: 'none' };

/** What a job that just reached `job.status` does. */
export function jobOutcome(
  job: TsxJobIpc,
  context: { openFolderPath: string | null; watchedJobId: string | null },
): JobOutcome {
  if (job.status === 'error') {
    return { type: 'error', message: `${job.kind === 'build' ? 'Build' : 'Generation'} failed: ${job.error ?? 'Unknown error'}` };
  }
  if (job.status !== 'done' || !job.versionPath || !job.folderPath) return { type: 'none' };
  const { versionPath, folderPath } = job;
  const notice = job.build?.notice ? { notice: job.build.notice } : {};
  if (isNewProjectJob(job)) {
    if (!context.openFolderPath || context.watchedJobId === job.id) return { type: 'open', versionPath, folderPath, ...notice };
    return { type: 'offer', message: job.kind === 'build' ? 'New build ready' : 'New generation ready', versionPath, folderPath, ...notice };
  }
  const message = context.openFolderPath === folderPath
    ? 'New version ready'
    : `New version saved in ${folderPath.split(/[\\/]/).pop()}`;
  return { type: 'offer', message, versionPath, folderPath, ...notice };
}
