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
// - Later messages are builder edits (part 3): a `build` with `editOf`, whose
//   target is the open folder. It drives the open project's busy state as the
//   pipeline's edit / fix did, and opens its result when it was watched.

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

/** A job that adds a version to a project: a builder edit, or the pipeline's edit / fix (restored from before part 3). */
export function isEditJob(job: TsxJobIpc): boolean {
  return job.kind === 'edit' || job.kind === 'fix' || (job.kind === 'build' && Boolean(job.targetFolderPath));
}

function folderName(folderPath: string): string {
  return folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath;
}

/** A job's name in the strip, the toolbar and the build panel: the project, else (an edit) its folder, else the prompt. */
export function jobTitle(job: TsxJobIpc): string {
  if (job.projectName) return job.projectName;
  if (isEditJob(job) && job.targetFolderPath) return folderName(job.targetFolderPath);
  return job.prompt;
}

/** Running jobs that will add a project: placeholder rows in the library. */
export function pendingProjectJobs(jobs: TsxJobIpc[]): TsxJobIpc[] {
  return jobs.filter((j) => isNewProjectJob(j) && isJobActive(j));
}

/** The open project's edit in flight (a builder edit, or a restored edit / fix): it makes the project busy. */
export function openProjectJob(jobs: TsxJobIpc[], openFolderPath: string | null): TsxJobIpc | null {
  if (!openFolderPath) return null;
  return jobs.find((j) => isEditJob(j) && j.targetFolderPath === openFolderPath && isJobActive(j)) ?? null;
}

function newest(jobs: TsxJobIpc[]): TsxJobIpc | null {
  return [...jobs].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/**
 * Which job streams into the preview panel in place of the player: a restored
 * pipeline edit / fix of the open project, or (nothing open) the newest
 * generation. A builder edit leaves the player alone: its notes are in the
 * build panel.
 */
export function previewStreamJob(jobs: TsxJobIpc[], openFolderPath: string | null): TsxJobIpc | null {
  const editing = openProjectJob(jobs, openFolderPath);
  if (editing) return editing.kind === 'build' ? null : editing;
  return openFolderPath ? null : newest(jobs.filter((j) => j.kind === 'generate' && j.status === 'generating'));
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
    const what = job.kind === 'build' ? (isEditJob(job) ? 'Edit' : 'Build') : 'Generation';
    return { type: 'error', message: `${what} failed: ${job.error ?? 'Unknown error'}` };
  }
  if (job.status !== 'done' || !job.versionPath || !job.folderPath) return { type: 'none' };
  const { versionPath, folderPath } = job;
  const notice = job.build?.notice ? { notice: job.build.notice } : {};
  if (isNewProjectJob(job)) {
    if (!context.openFolderPath || context.watchedJobId === job.id) return { type: 'open', versionPath, folderPath, ...notice };
    return { type: 'offer', message: job.kind === 'build' ? 'New build ready' : 'New generation ready', versionPath, folderPath, ...notice };
  }
  // A builder edit the user watched: its result is what they were waiting for.
  if (job.kind === 'build' && context.watchedJobId === job.id) return { type: 'open', versionPath, folderPath, ...notice };
  const message = context.openFolderPath === folderPath
    ? 'New version ready'
    : `New version saved in ${folderName(folderPath)}`;
  return { type: 'offer', message, versionPath, folderPath, ...notice };
}

/** A version saved into a Studio shot folder (append-only, SHOT_QUALITY_DESIGN Q2): where it went and how to use it. */
export function studioSaveNotice(version: number | null, studioProjectId: string, openStudioProjectId: string | null): string {
  const name = version !== null ? `v${version}` : 'a new version';
  return studioProjectId === openStudioProjectId
    ? `Saved ${name} into the open Studio project — pick it in the shot's version picker to use it`
    : `Saved ${name} into Studio project "${studioProjectId}"`;
}
