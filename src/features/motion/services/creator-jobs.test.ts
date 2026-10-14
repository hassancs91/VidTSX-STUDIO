import { describe, expect, it } from 'vitest';
import type { TsxJobIpc } from '@shared/ipc/types';
import {
  centreBuildJob,
  isCreatorJob,
  jobOutcome,
  openProjectJob,
  pendingProjectJobs,
  previewStreamJob,
  waitingFor,
} from './creator-jobs';

// Where the Creator shows a job and what a finished one does: builds join
// generations in the library and the centre panel; a watched build opens
// when it finishes; other callers' jobs are not the Creator's.

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

  it('library placeholders: running generations and new builds, not edits or finished jobs', () => {
    const gen = job({ kind: 'generate' });
    const build = job({ status: 'queued' });
    const jobs = [gen, build, job({ kind: 'edit', targetFolderPath: 'C:/p' }), job({ targetFolderPath: 'C:/p' }), job({ status: 'done' })];
    expect(pendingProjectJobs(jobs)).toEqual([gen, build]);
  });

  it('the open project\'s edit / fix in flight, and the preview\'s stream', () => {
    const edit = job({ kind: 'edit', targetFolderPath: 'C:/p' });
    const gen = job({ kind: 'generate' });
    expect(openProjectJob([edit, gen], 'C:/p')).toBe(edit);
    expect(openProjectJob([edit], 'C:/q')).toBeNull();
    expect(previewStreamJob([edit, gen], 'C:/p')).toBe(edit);
    expect(previewStreamJob([edit, gen], null)).toBe(gen);
    expect(previewStreamJob([gen], 'C:/q')).toBeNull();
  });

  it('the centre shows the watched build, else (nothing open) the newest running one', () => {
    const older = job();
    const newer = job({ status: 'queued' });
    const done = job({ status: 'error' });
    expect(centreBuildJob([older, newer, done], done.id, 'C:/p')).toBe(done);
    expect(centreBuildJob([older, newer], null, null)).toBe(newer);
    expect(centreBuildJob([older, newer], null, 'C:/p')).toBeNull();
    expect(centreBuildJob([older], 'gone', null)).toBe(older);
    expect(centreBuildJob([job({ kind: 'generate' })], null, null)).toBeNull();
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

  it('a capped build carries its notice; a generation and an edit keep their old wording', () => {
    const capped = job({ status: 'done', ...saved, build: { notice: 'Time ran out; kept the last build that passed check.' } as TsxJobIpc['build'] });
    expect(jobOutcome(capped, { openFolderPath: null, watchedJobId: null }))
      .toMatchObject({ type: 'open', notice: 'Time ran out; kept the last build that passed check.' });
    expect(jobOutcome(job({ kind: 'generate', status: 'done', ...saved }), { openFolderPath: 'C:/x', watchedJobId: null }))
      .toMatchObject({ type: 'offer', message: 'New generation ready' });
    const edit = job({ kind: 'edit', status: 'done', targetFolderPath: saved.folderPath, ...saved });
    expect(jobOutcome(edit, { openFolderPath: saved.folderPath, watchedJobId: null })).toMatchObject({ type: 'offer', message: 'New version ready' });
    expect(jobOutcome(edit, { openFolderPath: null, watchedJobId: null })).toMatchObject({ type: 'offer', message: 'New version saved in bounce' });
  });

  it('errors name the kind; a cancel or a running job does nothing', () => {
    expect(jobOutcome(job({ status: 'error', error: 'no tools' }), { openFolderPath: null, watchedJobId: null }))
      .toEqual({ type: 'error', message: 'Build failed: no tools' });
    expect(jobOutcome(job({ kind: 'generate', status: 'error' }), { openFolderPath: null, watchedJobId: null }))
      .toEqual({ type: 'error', message: 'Generation failed: Unknown error' });
    expect(jobOutcome(job({ status: 'cancelled' }), { openFolderPath: null, watchedJobId: null })).toEqual({ type: 'none' });
    expect(jobOutcome(job(), { openFolderPath: null, watchedJobId: null })).toEqual({ type: 'none' });
  });
});
