import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { GenerateTsxRequest, GenerateTsxResult } from '../tsx-builder/types';
import type { TsxJobIpc, TsxJobStartRequest } from '@shared/ipc/types';

// Kind `build` in the job engine (P1 part 6), with generateTsx() faked: the
// snapshot follows the builder's events, the result lands on the job, builds
// run one at a time beside the pipeline jobs, and cancel / refusal / throw
// each end as the right status.

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir },
}));

let generateTsxImpl: (req: GenerateTsxRequest) => Promise<GenerateTsxResult>;
const generateTsxCalls: GenerateTsxRequest[] = [];
let activeBuilds = 0;
let peakBuilds = 0;
vi.mock('../tsx-builder/generate-tsx', () => ({
  generateTsx: async (req: GenerateTsxRequest) => {
    generateTsxCalls.push(req);
    activeBuilds++;
    peakBuilds = Math.max(peakBuilds, activeBuilds);
    try {
      return await generateTsxImpl(req);
    } finally {
      activeBuilds--;
    }
  },
}));

import { tsxJobEngine } from './tsx-job-engine';

const CODE = 'export const compositionConfig = { id: "Bounce", width: 1080, height: 1350, fps: 30, durationInFrames: 60 };\nexport default function Bounce() { return null; }';
const CAPS = { turns: 40, minutes: 15, outputTokens: 40_000 };
const TOKENS = { input: 120, output: 4600, cacheRead: 90_000, cacheCreation: 12_000 };

const status = (over: Record<string, unknown>) => ({
  phase: 'working',
  round: 0,
  roundsMax: 1,
  checks: 0,
  turns: 0,
  tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  elapsedMs: 0,
  ...over,
});

/** A finished Quick run: one look, a phone view, a seam, v1 saved into `folder`. */
async function finishedRun(folder: string): Promise<(req: GenerateTsxRequest) => Promise<GenerateTsxResult>> {
  await fs.mkdir(folder, { recursive: true });
  return async (req) => {
    const emit = req.onProgress!;
    emit({ type: 'start', budget: 'quick', caps: CAPS, roundsMin: 1, edit: false, status: status({ phase: 'preparing' }) } as never);
    emit({ type: 'phase', status: status({ phase: 'working' }) } as never);
    req.onText?.('DESIGN: a red ball ');
    emit({ type: 'turn', turn: 1, outputTokens: 900, status: status({ turns: 1, tokens: { ...TOKENS, output: 900 } }) } as never);
    emit({ type: 'check', n: 1, ok: true, errors: [], status: status({ phase: 'checking', checks: 1, turns: 1 }) } as never);
    emit({
      type: 'stills',
      size: 'model',
      frames: [0, 30, 59],
      paths: ['/run/stills/r01-f000.jpg', '/run/stills/r01-f030.jpg', '/run/stills/r01-f059.jpg'],
      status: status({ phase: 'rendering', round: 1, checks: 1, turns: 2 }),
    } as never);
    req.onText?.('looks right.');
    emit({ type: 'seam', jump: false, wrap: 0.04, neighbours: 0.05, status: status({ round: 1, checks: 2, turns: 4 }) } as never);
    emit({ type: 'phase', status: status({ phase: 'saving', round: 1, checks: 3, turns: 5, tokens: TOKENS, elapsedMs: 52_000 }) } as never);
    const tsxPath = path.join(folder, 'v1.tsx');
    await fs.writeFile(tsxPath, CODE, 'utf-8');
    const build = {
      ok: true,
      finished: true,
      stopReason: 'finished' as const,
      version: { number: 1, folderPath: folder, tsxPath, srcDir: path.join(folder, 'v1.src'), stillsDir: path.join(folder, 'v1.stills'), debugPath: path.join(folder, 'v1.debug.json') },
      code: CODE,
      summary: 'A red ball, bouncing.',
      rounds: 1,
      checks: 3,
      seamOk: true,
      stills: [
        { round: 1, frame: 0, size: 'model' as const, file: 'v1.stills/r01-f000.jpg' },
        { round: 1, frame: 30, size: 'phone' as const, file: 'v1.stills/phone1-f030.jpg' },
      ],
      elapsedMs: 52_000,
      turns: 5,
      tokens: TOKENS,
      caps: CAPS,
      usage: { inputTokens: 102_120, outputTokens: 4600, costUsd: 0.45 },
    };
    emit({ type: 'done', stopReason: 'finished', ok: true, version: 1, status: status({ phase: 'done', round: 1, checks: 3, turns: 5, tokens: TOKENS, elapsedMs: 52_000 }) } as never);
    return { engine: 'builder', reason: 'tools', ok: true, stopReason: 'finished', code: CODE, elapsedMs: 52_000, build };
  };
}

function buildRequest(over: Partial<TsxJobStartRequest> = {}, build: Partial<NonNullable<TsxJobStartRequest['build']>> = {}): TsxJobStartRequest {
  return {
    kind: 'build',
    prompt: 'A red ball bounces once as a loop.',
    providerId: 'claude-subscription',
    options: { model: 'claude-sonnet-5-5' },
    build: { format: { width: 1080, height: 1350, fps: 30, durationInFrames: 60, loop: true }, budget: 'quick', ...build },
    ...over,
  };
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
    const existing = tsxJobEngine.list().find((j) => j.id === jobId);
    if (existing && ['done', 'error', 'cancelled'].includes(existing.status)) {
      clearTimeout(timer);
      unsubscribe();
      resolve(existing);
    }
  });
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-jobs-build-test-'));
});

beforeEach(() => {
  generateTsxCalls.length = 0;
  peakBuilds = 0;
  tsxJobEngine.clearCompleted();
  tsxJobEngine.configure({ maxConcurrent: 4 });
});

describe('tsx-job-engine: build jobs', () => {
  it('runs a build to done: the request reaches the builder, the snapshot follows its events, the result lands on the job', async () => {
    const folder = path.join(tmpDir, 'bounce');
    generateTsxImpl = await finishedRun(folder);
    const seen: TsxJobIpc[] = [];
    const streamed: string[] = [];
    const offEvent = tsxJobEngine.onEvent((job) => { if (job.kind === 'build') seen.push(job); });
    const offStream = tsxJobEngine.onStream((_id, chunk) => streamed.push(chunk));

    const { jobId, error } = tsxJobEngine.start(buildRequest());
    expect(error).toBeUndefined();
    const job = await waitForJob(jobId!);
    // Let the last stream flush land.
    await vi.waitFor(() => { expect(streamed.join('')).toBe('DESIGN: a red ball looks right.'); });
    offEvent();
    offStream();

    // What the builder received: the job's intent, format, budget, provider, model and its signal.
    const req = generateTsxCalls[0];
    expect(req).toMatchObject({
      intent: 'A red ball bounces once as a loop.',
      format: { width: 1080, height: 1350, fps: 30, durationInFrames: 60, loop: true },
      budget: 'quick',
      providerId: 'claude-subscription',
      model: 'claude-sonnet-5-5',
    });
    expect(req.signal).toBeInstanceOf(AbortSignal);

    // The snapshot moved with the events.
    const rendering = seen.find((j) => j.build?.phase === 'rendering')!;
    expect(rendering.status).toBe('generating');
    expect(rendering.progress).toEqual({ step: 'rendering', label: 'Round 1/1 · Rendering frames', percent: 90 });
    expect(rendering.build?.stills.map((s) => s.path)).toEqual(['/run/stills/r01-f000.jpg', '/run/stills/r01-f030.jpg', '/run/stills/r01-f059.jpg']);
    expect(rendering.build?.lastCheck).toEqual({ n: 1, ok: true, errors: [] });
    expect(rendering.build?.caps).toEqual(CAPS);
    const saving = seen.find((j) => j.status === 'saving')!;
    expect(saving.build?.seam).toEqual({ jump: false, wrap: 0.04, neighbours: 0.05 });
    expect(saving.progress.percent).toBe(98);

    // The result.
    expect(job.status).toBe('done');
    expect(job.projectName).toBe('bounce');
    expect(job.folderPath).toBe(folder);
    expect(job.versionPath).toBe(path.join(folder, 'v1.tsx'));
    expect(job.usage).toEqual({ inputTokens: 102_120, outputTokens: 4600, totalTokens: 106_720 });
    expect(job.progress).toEqual({ step: 'done', label: 'Complete', percent: 100 });
    expect(job.build).toMatchObject({
      budget: 'quick',
      edit: false,
      phase: 'done',
      round: 1,
      checks: 3,
      turns: 5,
      tokens: TOKENS,
      caps: CAPS,
      elapsedMs: 52_000,
      stopReason: 'finished',
      finished: true,
      seamOk: true,
      summary: 'A red ball, bouncing.',
    });
    expect(job.build?.notice).toBeUndefined();
    expect(job.build?.stills).toEqual([
      { round: 1, frame: 0, size: 'model', path: path.join(folder, 'v1.stills/r01-f000.jpg') },
      { round: 1, frame: 30, size: 'phone', path: path.join(folder, 'v1.stills/phone1-f030.jpg') },
    ]);
    const chat = JSON.parse(await fs.readFile(path.join(folder, 'chat.json'), 'utf-8'));
    expect(chat).toHaveLength(2);
    expect(chat[0]).toMatchObject({ role: 'user', content: 'A red ball bounces once as a loop.' });
    expect(chat[1].content).toBe('Built v1 (quick, 1 round, finished).');
    // The Creator's thread links the reply to its version and shows the builder's summary.
    expect(chat[1]).toMatchObject({ version: 1, summary: 'A red ball, bouncing.' });
  });

  it("an edit's thread turn says what the user asked (threadText) and the version it saved", async () => {
    const folder = path.join(tmpDir, 'bounce-edit');
    generateTsxImpl = await finishedRun(folder);
    const { jobId } = tsxJobEngine.start(buildRequest(
      { prompt: 'The Creator preview failed to load this version: …(the whole fix instruction)' },
      { format: undefined, budget: 'quick', editOf: { folderPath: folder, version: 1 }, threadText: 'Fix with AI: x is not defined' },
    ));
    const job = await waitForJob(jobId!);
    expect(job.status).toBe('done');
    // The fake builder's start event says edit: false; the version asked for stays on the snapshot.
    expect(job.build?.editVersion).toBe(1);
    const chat = JSON.parse(await fs.readFile(path.join(folder, 'chat.json'), 'utf-8'));
    expect(chat[0]).toMatchObject({ role: 'user', content: 'Fix with AI: x is not defined' });
    expect(chat[1]).toMatchObject({ role: 'assistant', content: 'Applied edit — saved as v1 (quick, 1 round, finished).', version: 1 });
  });

  it('validates the build block at start, and an edit names its target folder', () => {
    expect(tsxJobEngine.start({ kind: 'build', prompt: 'x' }).error).toBe('A build job needs its build settings');
    expect(tsxJobEngine.start(buildRequest({}, { budget: 'epic' as never })).error).toContain('Unknown build budget');
    expect(tsxJobEngine.start({ kind: 'build', prompt: 'x', build: { budget: 'quick' } }).error).toContain('needs a format');
    expect(tsxJobEngine.start(buildRequest({}, { format: { width: 0, height: 1080, fps: 30 } })).error).toContain('positive width');

    generateTsxImpl = async () => ({ engine: 'builder', reason: 'tools', ok: false, stopReason: 'error', error: 'nothing', elapsedMs: 1 });
    const { jobId, error } = tsxJobEngine.start({ kind: 'build', prompt: 'bigger title', build: { budget: 'standard', editOf: { folderPath: 'C:/projects/bounce' } } });
    expect(error).toBeUndefined();
    const queued = tsxJobEngine.list().find((j) => j.id === jobId)!;
    expect(queued.targetFolderPath).toBe('C:/projects/bounce');
    expect(queued.build).toMatchObject({ budget: 'standard', edit: true, phase: 'preparing', round: 0, stills: [] });
  });

  it('runs builds one at a time: the second waits queued for the first', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    generateTsxImpl = async () => {
      await gate;
      return { engine: 'builder', reason: 'tools', ok: false, stopReason: 'error', error: 'The builder stopped without calling finish.', elapsedMs: 1 };
    };

    const a = tsxJobEngine.start(buildRequest({ prompt: 'build one' })).jobId!;
    const b = tsxJobEngine.start(buildRequest({ prompt: 'build two' })).jobId!;

    await vi.waitFor(() => expect(generateTsxCalls).toHaveLength(1));
    const statuses = Object.fromEntries(tsxJobEngine.list().filter((j) => [a, b].includes(j.id)).map((j) => [j.id, j.status]));
    expect(statuses[a]).toBe('generating');
    expect(statuses[b]).toBe('queued');

    release();
    const [jobA, jobB] = await Promise.all([waitForJob(a), waitForJob(b)]);
    expect(jobA.status).toBe('error');
    expect(jobB.status).toBe('error');
    expect(generateTsxCalls).toHaveLength(2);
    expect(peakBuilds).toBe(1);
  });

  it('cancel reaches the builder through the job signal and ends as cancelled', async () => {
    let sawAbort = false;
    generateTsxImpl = (req) => new Promise((resolve) => {
      req.signal!.addEventListener('abort', () => {
        sawAbort = true;
        req.onProgress!({ type: 'stopping', reason: 'cancelled', status: status({ phase: 'rendering', round: 1 }) } as never);
        resolve({ engine: 'builder', reason: 'tools', ok: false, stopReason: 'cancelled', error: 'Cancelled.', elapsedMs: 3, build: {
          ok: false, finished: false, stopReason: 'cancelled', rounds: 1, checks: 1, stills: [], elapsedMs: 3, turns: 2, tokens: TOKENS, caps: CAPS, runDir: '/run', error: 'Cancelled.',
        } });
      });
    });
    const { jobId } = tsxJobEngine.start(buildRequest({ prompt: 'cancel me' }));
    await vi.waitFor(() => { expect(generateTsxCalls.some((r) => r.intent === 'cancel me')).toBe(true); });
    tsxJobEngine.cancel(jobId!);
    const job = await waitForJob(jobId!);

    expect(sawAbort).toBe(true);
    expect(job.status).toBe('cancelled');
    expect(job.versionPath).toBeUndefined();
    expect(job.build).toMatchObject({ phase: 'done', stopReason: 'cancelled', stopping: 'cancelled', finished: false, round: 1 });
  });

  it('a refusal before the run is a job error with the message', async () => {
    generateTsxImpl = async () => ({ engine: 'none', reason: 'no-tools', ok: false, stopReason: 'error', error: 'TSX generation needs Claude or OpenRouter: provider "gemini" (gemini) cannot run tools.', elapsedMs: 1 });
    const { jobId } = tsxJobEngine.start(buildRequest({ prompt: 'refused', providerId: 'gemini' }));
    const job = await waitForJob(jobId!);
    expect(job.status).toBe('error');
    expect(job.error).toContain('needs Claude or OpenRouter');
    expect(job.build?.phase).toBe('preparing');
  });

  it('a capped run that kept a build is done, with the cap as a notice', async () => {
    const folder = path.join(tmpDir, 'capped');
    const finished = await finishedRun(folder);
    generateTsxImpl = async (req) => {
      const result = await finished(req);
      const build = (result as Extract<GenerateTsxResult, { engine: 'builder' }>).build!;
      return { ...result, stopReason: 'cap-time', error: 'Stopped at the 15-minute cap.', build: { ...build, finished: false, stopReason: 'cap-time', error: 'Stopped at the 15-minute cap.', summary: undefined, seamOk: false } };
    };
    const { jobId } = tsxJobEngine.start(buildRequest({ prompt: 'capped' }));
    const job = await waitForJob(jobId!);
    expect(job.status).toBe('done');
    expect(job.error).toBeUndefined();
    expect(job.versionPath).toBe(path.join(folder, 'v1.tsx'));
    expect(job.build).toMatchObject({ stopReason: 'cap-time', finished: false, seamOk: false, notice: 'Stopped at the 15-minute cap.' });
    const chat = JSON.parse(await fs.readFile(path.join(folder, 'chat.json'), 'utf-8'));
    expect(chat[1].content).toBe('Built v1 (quick, 1 round, Stopped at the 15-minute cap.).');
  });

  it('an unexpected throw marks the job failed', async () => {
    generateTsxImpl = async () => { throw new Error('EPERM on the run folder'); };
    const { jobId } = tsxJobEngine.start(buildRequest({ prompt: 'throws' }));
    const job = await waitForJob(jobId!);
    expect(job.status).toBe('error');
    expect(job.error).toBe('EPERM on the run folder');
  });
});

describe("tsx-job-engine: another caller's builds (P3 part 1)", () => {
  it('carry their origin, folder and usage; run while restored jobs are held, without releasing them; are never persisted', async () => {
    const persistPath = path.join(tmpDir, 'tsx-jobs.json');
    await fs.writeFile(persistPath, JSON.stringify([{ request: buildRequest({ prompt: 'held from the last quit' }), createdAt: 1 }]), 'utf-8');
    await tsxJobEngine.restore();
    const held = tsxJobEngine.list().find((j) => j.prompt === 'held from the last quit')!;
    expect(held.status).toBe('queued');
    await fs.writeFile(persistPath, '[]', 'utf-8');

    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    generateTsxImpl = async () => {
      await gate;
      return { engine: 'builder', reason: 'tools', ok: false, stopReason: 'error', error: 'stopped', elapsedMs: 1 };
    };
    const into = path.join(tmpDir, 'session', 'compositions', 'bounce');
    const owner = { origin: 'agent' as const, into, usage: { featureSource: 'agent' as const, agentId: 'lwh.infographic-loop' } };
    const a = tsxJobEngine.start(buildRequest({ prompt: 'agent build one' }), owner).jobId!;
    const b = tsxJobEngine.start(buildRequest({ prompt: 'agent build two' }), owner).jobId!;
    // A removed pipeline kind (P3 part 8) is refused for any caller.
    expect(tsxJobEngine.start({ kind: 'generate' as unknown as 'build', prompt: 'x' }, owner).error).toBe('Only build jobs exist: the one-shot pipeline was removed.');

    await vi.waitFor(() => expect(generateTsxCalls.map((r) => r.intent)).toEqual(['agent build one']));
    expect(generateTsxCalls[0]).toMatchObject({ into, usage: { featureSource: 'agent', agentId: 'lwh.infographic-loop' } });
    const jobs = Object.fromEntries(tsxJobEngine.list().map((j) => [j.id, j]));
    expect(jobs[a]).toMatchObject({ origin: 'agent', targetFolderPath: into, status: 'generating' });
    expect(jobs[b]).toMatchObject({ origin: 'agent', status: 'queued' });
    expect(jobs[held.id].status).toBe('queued');
    // The queued list on disk keeps the held Creator job and never the caller's.
    await vi.waitFor(async () => {
      const saved = JSON.parse(await fs.readFile(persistPath, 'utf-8')) as Array<{ request: { prompt: string } }>;
      expect(saved.map((p) => p.request.prompt)).toEqual(['held from the last quit']);
    }, { timeout: 2000 });

    release();
    await Promise.all([waitForJob(a), waitForJob(b)]);
    expect(generateTsxCalls).toHaveLength(2);
    expect(tsxJobEngine.list().find((j) => j.id === held.id)!.status).toBe('queued');

    tsxJobEngine.cancel(held.id);
    // A Creator start (here a refused one) is what releases a held queue.
    tsxJobEngine.start({ kind: 'build', prompt: 'x' });
  });
});
