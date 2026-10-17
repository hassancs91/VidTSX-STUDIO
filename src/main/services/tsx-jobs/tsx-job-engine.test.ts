import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { TsxJobIpc, TsxJobStartRequest } from '@shared/ipc/types';
import type { GenerateTsxRequest, GenerateTsxResult } from '../tsx-builder/types';

// The engine's queue, cancel and restore, on build jobs (P3 part 8: the
// pipeline's kinds are gone). The builder is faked; tsx-job-engine-build.test
// covers what a build job does with its result.

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir },
}));

const STOPPED: GenerateTsxResult = { engine: 'builder', reason: 'tools', ok: false, stopReason: 'error', error: 'stopped', elapsedMs: 1 };
let generateTsxImpl: (req: GenerateTsxRequest) => Promise<GenerateTsxResult> = async () => STOPPED;
const generateTsxCalls: GenerateTsxRequest[] = [];
vi.mock('../tsx-builder/generate-tsx', () => ({
  generateTsx: async (req: GenerateTsxRequest) => {
    generateTsxCalls.push(req);
    return generateTsxImpl(req);
  },
}));

import { tsxJobEngine } from './tsx-job-engine';

function build(prompt: string): TsxJobStartRequest {
  return { kind: 'build', prompt, build: { budget: 'quick', format: { width: 1080, height: 1080, fps: 30, durationInFrames: 30 } } };
}

function waitForJob(jobId: string, timeoutMs = 5000): Promise<TsxJobIpc> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Job ${jobId} did not finish within ${timeoutMs}ms`));
    }, timeoutMs);
    const unsubscribe = tsxJobEngine.onEvent((job) => {
      if (job.id === jobId && ['done', 'error', 'cancelled'].includes(job.status)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(job);
      }
    });
    // The job may already be finished
    const existing = tsxJobEngine.list().find((j) => j.id === jobId);
    if (existing && ['done', 'error', 'cancelled'].includes(existing.status)) {
      clearTimeout(timer);
      unsubscribe();
      resolve(existing);
    }
  });
}

/** The fake builder waits for `release()`; every build it ran shows in generateTsxCalls. */
function gated(): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  generateTsxImpl = async () => {
    await gate;
    return STOPPED;
  };
  return release;
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-jobs-test-'));
});

beforeEach(() => {
  generateTsxCalls.length = 0;
  generateTsxImpl = async () => STOPPED;
  tsxJobEngine.clearCompleted();
});

describe('tsx-job-engine', () => {
  it('queues builds behind the running one and drains them in order', async () => {
    const release = gated();
    const ids = Array.from({ length: 4 }, (_, i) => tsxJobEngine.start(build(`anim ${i}`)).jobId!);

    await vi.waitFor(() => { expect(generateTsxCalls).toHaveLength(1); });
    const statuses = tsxJobEngine.list().filter((j) => ids.includes(j.id)).map((j) => j.status);
    expect(statuses.filter((s) => s === 'queued')).toHaveLength(3);

    release();
    const jobs = await Promise.all(ids.map((id) => waitForJob(id)));
    expect(jobs.every((j) => j.status === 'error')).toBe(true);
    expect(generateTsxCalls.map((r) => r.intent)).toEqual(['anim 0', 'anim 1', 'anim 2', 'anim 3']);
  });

  it('cancels a queued job without running it', async () => {
    const release = gated();
    const running = tsxJobEngine.start(build('blocker')).jobId!;
    const queuedId = tsxJobEngine.start(build('queued')).jobId!;

    tsxJobEngine.cancel(queuedId);
    const cancelled = await waitForJob(queuedId);
    expect(cancelled.status).toBe('cancelled');

    release();
    await waitForJob(running);
    expect(generateTsxCalls.map((r) => r.intent)).toEqual(['blocker']);
  });

  it('refuses an empty prompt, and a kind the app no longer has', () => {
    expect(tsxJobEngine.start(build('   ')).error).toBe('Prompt is required');
    expect(tsxJobEngine.start({ kind: 'generate' as unknown as 'build', prompt: 'a bouncing ball' }).error).toBe(
      'Only build jobs exist: the one-shot pipeline was removed.',
    );
    expect(generateTsxCalls).toEqual([]);
  });

  // Last: restore holds the queue for the rest of the module.
  it('restore drops a queued pipeline job from an older app and holds the builds', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'tsx-jobs.json'),
      JSON.stringify([
        { request: { kind: 'generate', prompt: 'old pipeline job', options: { mode: '2d' } }, createdAt: 1 },
        { request: build('queued build'), createdAt: 2 },
      ]),
      'utf-8',
    );
    await tsxJobEngine.restore();

    const restored = tsxJobEngine.list().filter((j) => j.status === 'queued');
    expect(restored.map((j) => j.prompt)).toEqual(['queued build']);
    expect(generateTsxCalls).toEqual([]); // held until the user starts one
    tsxJobEngine.cancel(restored[0].id);
  });
});
