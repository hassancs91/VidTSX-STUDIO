import { describe, expect, it } from 'vitest';
import type { TsxJobIpc } from '@shared/ipc/types';
import {
  centreBuildJob,
  isCreatorJob,
  isEditJob,
  jobOutcome,
  jobTitle,
  openProjectJob,
  pendingProjectJobs,
  studioSaveNotice,
  waitingFor,
} from './creator-jobs';

// Where the Creator shows a job and what a finished one does: new builds show
// in the library and the centre panel; a watched build opens when it
// finishes; other callers' jobs are not the Creator's. Every job is a build
// (P3 part 8).

let clock = 0;
const job = (over: Partial<TsxJobIpc> = {}): TsxJobIpc => ({
  id: `j${++clock}`,
  kind: 'build',
  prompt: 'a ball',
  status: 'generating',
  progress: { step: 'working', label: 'Round 1/3 · Designing and writing', percent: 30 },
  createdAt: clock,
  ...over,
});

describe('which jobs show where', () => {
  it('a job from an agent, Studio or a flow is not the Creator\'s', () => {
    expect(isCreatorJob(job())).toBe(true);
    expect(isCreatorJob(job({ origin: 'creator' }))).toBe(true);
    expect(isCreatorJob(job({ origin: 'agent' }))).toBe(false);
    expect(isCreatorJob(job({ origin: 'studio' }))).toBe(false);
  });

  it('library placeholders: running new builds, not edits or finished jobs', () => {
    const running = job();
    const queued = job({ status: 'queued' });
    const jobs = [running, queued, job({ targetFolderPath: 'C:/p' }), job({ status: 'done' })];
    expect(pendingProjectJobs(jobs)).toEqual([running, queued]);
  });

  it('the open project\'s edit in flight', () => {
    const edit = job({ targetFolderPath: 'C:/p' });
    const fresh = job();
    expect(openProjectJob([edit, fresh], 'C:/p')).toBe(edit);
    expect(openProjectJob([edit], 'C:/q')).toBeNull();
  });

  it('the centre shows the watched build, else (nothing open) the newest running one', () => {
    const older = job();
    const newer = job({ status: 'queued' });
    const done = job({ status: 'error' });
    expect(centreBuildJob([older, newer, done], done.id, 'C:/p')).toBe(done);
    expect(centreBuildJob([older, newer], null, null)).toBe(newer);
    expect(centreBuildJob([older, newer], null, 'C:/p')).toBeNull();
    expect(centreBuildJob([older], 'gone', null)).toBe(older);
  });

  it('a queued build says whose build it waits for', () => {
    const running = job();
    const queued = job({ status: 'queued' });
    expect(waitingFor(queued, [running, queued], false)).toBe('creator');
    expect(waitingFor(queued, [queued], true)).toBe('other');
    expect(waitingFor(queued, [queued], false)).toBeNull();
    expect(waitingFor(running, [running], true)).toBeNull();
  });
});

describe('jobOutcome', () => {
  const saved = { versionPath: 'C:/lib/bounce/v1.tsx', folderPath: 'C:/lib/bounce' };

  it('a new build opens when nothing is open or when it was watched; else it is offered', () => {
    const done = job({ status: 'done', ...saved });
    expect(jobOutcome(done, { openFolderPath: null, watchedJobId: null })).toEqual({ type: 'open', ...saved });
    expect(jobOutcome(done, { openFolderPath: 'C:/other', watchedJobId: done.id })).toEqual({ type: 'open', ...saved });
    expect(jobOutcome(done, { openFolderPath: 'C:/other', watchedJobId: null }))
      .toEqual({ type: 'offer', message: 'New build ready', ...saved });
  });

  it('a capped build carries its notice; an unwatched edit is offered by where it saved', () => {
    const capped = job({ status: 'done', ...saved, build: { notice: 'Time ran out; kept the last build that passed check.' } as TsxJobIpc['build'] });
    expect(jobOutcome(capped, { openFolderPath: null, watchedJobId: null }))
      .toMatchObject({ type: 'open', notice: 'Time ran out; kept the last build that passed check.' });
    const edit = job({ status: 'done', targetFolderPath: saved.folderPath, ...saved });
    expect(jobOutcome(edit, { openFolderPath: saved.folderPath, watchedJobId: null })).toMatchObject({ type: 'offer', message: 'New version ready' });
    expect(jobOutcome(edit, { openFolderPath: null, watchedJobId: null })).toMatchObject({ type: 'offer', message: 'New version saved in bounce' });
  });

  it('errors say Build or Edit; a cancel or a running job does nothing', () => {
    expect(jobOutcome(job({ status: 'error', error: 'no tools' }), { openFolderPath: null, watchedJobId: null }))
      .toEqual({ type: 'error', message: 'Build failed: no tools' });
    expect(jobOutcome(job({ status: 'error' }), { openFolderPath: null, watchedJobId: null }))
      .toEqual({ type: 'error', message: 'Build failed: Unknown error' });
    expect(jobOutcome(job({ status: 'cancelled' }), { openFolderPath: null, watchedJobId: null })).toEqual({ type: 'none' });
    expect(jobOutcome(job(), { openFolderPath: null, watchedJobId: null })).toEqual({ type: 'none' });
  });
});

describe('builder edits (part 3)', () => {
  const saved = { versionPath: 'C:/lib/bounce/v3.tsx', folderPath: 'C:/lib/bounce' };
  const editBuild = (over: Partial<TsxJobIpc> = {}) => job({ targetFolderPath: saved.folderPath, prompt: 'The Creator preview cannot load v2: …', ...over });

  it('a build with a target folder is an edit, named after its folder until it saves', () => {
    expect(isEditJob(editBuild())).toBe(true);
    expect(isEditJob(job())).toBe(false);
    expect(jobTitle(editBuild())).toBe('bounce');
    expect(jobTitle(editBuild({ projectName: 'bounce' }))).toBe('bounce');
    expect(jobTitle(job({ prompt: 'a ball' }))).toBe('a ball');
  });

  it('makes the open project busy without taking the player away', () => {
    const edit = editBuild();
    expect(openProjectJob([edit], saved.folderPath)).toBe(edit);
    expect(openProjectJob([editBuild({ status: 'done' })], saved.folderPath)).toBeNull();
    expect(pendingProjectJobs([edit])).toEqual([]);
    // It is not the centre's unless watched.
    expect(centreBuildJob([edit], null, saved.folderPath)).toBeNull();
    expect(centreBuildJob([edit], edit.id, saved.folderPath)).toBe(edit);
  });

  it('a watched edit opens its version; an unwatched one is offered; a failure says Edit', () => {
    const done = editBuild({ status: 'done', ...saved });
    expect(jobOutcome(done, { openFolderPath: saved.folderPath, watchedJobId: done.id })).toEqual({ type: 'open', ...saved });
    expect(jobOutcome(done, { openFolderPath: saved.folderPath, watchedJobId: null })).toEqual({ type: 'offer', message: 'New version ready', ...saved });
    expect(jobOutcome(editBuild({ status: 'error', error: 'cap' }), { openFolderPath: null, watchedJobId: null }))
      .toEqual({ type: 'error', message: 'Edit failed: cap' });
  });

  it('a version saved into a Studio shot folder says where it went', () => {
    expect(studioSaveNotice(4, 'video-10', 'video-10')).toBe("Saved v4 into the open Studio project — pick it in the shot's version picker to use it");
    expect(studioSaveNotice(4, 'video-10', null)).toBe('Saved v4 into Studio project "video-10"');
  });
});
