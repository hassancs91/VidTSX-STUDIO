import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { followJob, jobRequestFor, keepJobResult, type BuildSpikeRequest, type SpikeJobEngine } from './builder-spike-job';
import type { TsxJobIpc, TsxJobStartRequest, TsxJobStatus } from '@shared/ipc/types';

// The dev entry's `build` mode drives the job engine (P1 part 7): the request
// maps onto a `build` job, the events emitted inside start() are kept, other
// jobs' events and chunks are not, the run settles on a final status, and
// held restored jobs are cancelled before ours can release them.

const job = (id: string, status: TsxJobStatus, over: Partial<TsxJobIpc> = {}): TsxJobIpc => ({
  id,
  kind: 'build',
  prompt: 'p',
  status,
  progress: { step: status, label: status, percent: 0 },
  createdAt: 0,
  ...over,
});

class FakeEngine implements SpikeJobEngine {
  listeners = new Set<(j: TsxJobIpc) => void>();
  streamListeners = new Set<(id: string, chunk: string) => void>();
  started: TsxJobStartRequest[] = [];
  cancelled: string[] = [];
  constructor(
    private queued: TsxJobIpc[] = [],
    private onStart: (engine: FakeEngine) => { jobId?: string; error?: string } = () => ({ jobId: 'j1' }),
  ) {}
  start(request: TsxJobStartRequest) {
    this.started.push(request);
    return this.onStart(this);
  }
  cancel(jobId: string) {
    this.cancelled.push(jobId);
    return { success: true };
  }
  list() {
    return this.queued;
  }
  onEvent(listener: (j: TsxJobIpc) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onStream(listener: (id: string, chunk: string) => void) {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }
  emit(j: TsxJobIpc) {
    for (const l of this.listeners) l(j);
  }
  chunk(id: string, text: string) {
    for (const l of this.streamListeners) l(id, text);
  }
}

const REQ: BuildSpikeRequest = {
  mode: 'build',
  intent: 'A ball bounces',
  format: { width: 1080, height: 1350, fps: 30, durationInFrames: 60, loop: true },
  outDir: 'x',
  budget: 'craft',
  model: 'claude-opus-5-5',
  maxMinutes: 60,
};

describe('jobRequestFor', () => {
  it('maps a new build onto a build job, model in options, packs as bodies', () => {
    const packs = [{ name: 'loop', body: '# Loop' }];
    expect(jobRequestFor(REQ, packs)).toEqual({
      kind: 'build',
      prompt: 'A ball bounces',
      options: { model: 'claude-opus-5-5' },
      build: { budget: 'craft', format: REQ.format, packs, maxMinutes: 60 },
    });
  });

  it('an edit carries editOf and no format; absent fields stay absent', () => {
    const edit: BuildSpikeRequest = { mode: 'build', intent: 'Slower', outDir: 'x', budget: 'standard', editOf: { folderPath: 'D:/p/b2' }, providerId: 'openrouter' };
    expect(jobRequestFor(edit, [])).toEqual({
      kind: 'build',
      prompt: 'Slower',
      providerId: 'openrouter',
      build: { budget: 'standard', editOf: { folderPath: 'D:/p/b2' } },
    });
  });
});

describe('followJob', () => {
  it('keeps the events emitted inside start(), filters other jobs, settles on done', async () => {
    const engine = new FakeEngine([], (e) => {
      e.emit(job('j1', 'queued'));
      e.emit(job('other', 'generating'));
      e.emit(job('j1', 'generating'));
      return { jobId: 'j1' };
    });
    const lines: object[] = [];
    const run = followJob(engine, jobRequestFor(REQ, []), { write: (l) => lines.push(l) });
    await Promise.resolve();
    engine.chunk('j1', 'DESIGN: ');
    engine.chunk('other', 'not ours');
    engine.emit(job('other', 'done'));
    engine.emit(job('j1', 'saving'));
    engine.emit(job('j1', 'done', { folderPath: 'D:/p/ball' }));
    const followed = await run;

    expect(followed.jobId).toBe('j1');
    expect(followed.final?.status).toBe('done');
    expect(followed.events).toBe(4);
    expect(followed.streamChunks).toBe(1);
    expect(lines).toEqual([
      { job: job('j1', 'queued') },
      { job: job('j1', 'generating') },
      { stream: 'DESIGN: ' },
      { job: job('j1', 'saving') },
      { job: job('j1', 'done', { folderPath: 'D:/p/ball' }) },
    ]);
    expect(engine.listeners.size).toBe(0);
    expect(engine.streamListeners.size).toBe(0);
    expect(engine.started[0]?.kind).toBe('build');
  });

  it('cancels held restored jobs before starting, so ours does not release them', async () => {
    const engine = new FakeEngine([job('held1', 'queued'), job('ran', 'done')]);
    const run = followJob(engine, jobRequestFor(REQ, []), { write: () => {} });
    await Promise.resolve();
    engine.emit(job('j1', 'error', { error: 'boom' }));
    const followed = await run;
    expect(engine.cancelled).toEqual(['held1']);
    expect(followed.heldCancelled).toEqual(['held1']);
    expect(followed.final?.error).toBe('boom');
  });

  it('a refused start writes nothing and reports why', async () => {
    const engine = new FakeEngine([], () => ({ error: 'A new build needs a format (width, height, fps)' }));
    const lines: object[] = [];
    const followed = await followJob(engine, jobRequestFor(REQ, []), { write: (l) => lines.push(l) });
    expect(followed.startError).toMatch(/needs a format/);
    expect(followed.final).toBeUndefined();
    expect(lines).toEqual([]);
    expect(engine.listeners.size).toBe(0);
  });

  it('cancelAfterMs cancels the job through the engine', async () => {
    const engine = new FakeEngine();
    const realCancel = engine.cancel.bind(engine);
    engine.cancel = (id: string) => {
      const out = realCancel(id);
      engine.emit(job(id, 'cancelled'));
      return out;
    };
    const followed = await followJob(engine, jobRequestFor(REQ, []), { write: () => {}, cancelAfterMs: 5 });
    expect(engine.cancelled).toEqual(['j1']);
    expect(followed.final?.status).toBe('cancelled');
    expect(followed.cancelSentAtMs).toBeGreaterThanOrEqual(0);
  });
});

describe('keepJobResult', () => {
  it('copies the saved project into outDir and reads the cost from the debug JSON', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'spike-job-'));
    const folder = path.join(tmp, 'library', 'CompoundCoins');
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.tsx'), 'code', 'utf-8');
    await fs.writeFile(path.join(folder, 'v1.debug.json'), JSON.stringify({ model: 'claude-opus-5-5', usage: { costUsd: 2.5 } }), 'utf-8');
    const final = job('j1', 'done', {
      startedAt: 1000,
      completedAt: 61_000,
      folderPath: folder,
      versionPath: path.join(folder, 'v1.tsx'),
      build: {
        budget: 'craft', edit: false, phase: 'done', round: 5, roundsMax: 6, checks: 8, turns: 40,
        tokens: { input: 10, output: 30_000, cacheRead: 900_000, cacheCreation: 60_000 },
        elapsedMs: 59_000, stills: [], stopReason: 'finished', finished: true, seamOk: true,
      },
    });
    const out = await keepJobResult(final, path.join(tmp, 'out'));
    expect(out).toMatchObject({ status: 'done', jobMs: 60_000, rounds: 5, turns: 40, seamOk: true, costUsd: 2.5, model: 'claude-opus-5-5' });
    expect(await fs.readFile(path.join(tmp, 'out', 'projects', 'CompoundCoins', 'v1.tsx'), 'utf-8')).toBe('code');
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('a job that saved nothing gives the numbers only', async () => {
    const out = await keepJobResult(job('j1', 'error', { error: 'no tools' }), 'unused');
    expect(out).toEqual({ status: 'error', error: 'no tools', jobMs: null, versionPath: null });
  });
});
