import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LlmGenerateRequest, LlmGenerateResponse, TsxJobIpc } from '@shared/ipc/types';

let tmpDir = '';

vi.mock('electron', () => ({
  app: { getPath: () => tmpDir },
}));

// The engine injects these as pipeline deps — stub the LLM and the transpiler
// so tests run without Electron, network, or esbuild.
let llmBehavior: (req: LlmGenerateRequest, signal?: AbortSignal) => Promise<LlmGenerateResponse>;
const llmCalls: LlmGenerateRequest[] = [];
let activeLlmCalls = 0;
let peakConcurrentLlmCalls = 0;

vi.mock('../../ipc/llm-handlers', () => ({
  runLlmGenerate: async (req: LlmGenerateRequest, signal?: AbortSignal) => {
    llmCalls.push(req);
    activeLlmCalls++;
    peakConcurrentLlmCalls = Math.max(peakConcurrentLlmCalls, activeLlmCalls);
    try {
      return await llmBehavior(req, signal);
    } finally {
      activeLlmCalls--;
    }
  },
}));

vi.mock('../../ipc/tsx-handlers', () => ({
  validateTsxCode: async () => ({ success: true }),
}));

import { tsxJobEngine } from './tsx-job-engine';

const TSX_OUTPUT = '```tsx\nimport React from "react";\nexport default function Anim() { return null; }\n```';

function respond(text: string): LlmGenerateResponse {
  return { success: true, text, model: 'test-model', durationMs: 1, usage: { inputTokens: 10, outputTokens: 20 } };
}

function defaultLlmBehavior(projectName = 'test-anim') {
  return async (req: LlmGenerateRequest): Promise<LlmGenerateResponse> => {
    if (req.systemPrompt?.includes('project name')) return respond(projectName);
    return respond(TSX_OUTPUT);
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
    // The job may already be finished
    const existing = tsxJobEngine.list().find((j) => j.id === jobId);
    if (existing && ['done', 'error', 'cancelled'].includes(existing.status)) {
      clearTimeout(timer);
      unsubscribe();
      resolve(existing);
    }
  });
}

const GEN_OPTIONS = { mode: '2d' as const, optimize: false, maxFixRetries: 0 };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsx-jobs-test-'));
});

beforeEach(() => {
  llmCalls.length = 0;
  peakConcurrentLlmCalls = 0;
  llmBehavior = defaultLlmBehavior();
  tsxJobEngine.clearCompleted();
});

describe('tsx-job-engine', () => {
  it('runs a generate job to done and writes v1.tsx + debug sidecar', async () => {
    const { jobId, error } = tsxJobEngine.start({ kind: 'generate', prompt: 'a bouncing ball', options: GEN_OPTIONS });
    expect(error).toBeUndefined();
    const job = await waitForJob(jobId!);

    expect(job.status).toBe('done');
    expect(job.projectName).toBe('test-anim');
    expect(job.folderPath).toBeTruthy();
    expect(job.versionPath).toMatch(/v1\.tsx$/);
    const written = await fs.readFile(job.versionPath!, 'utf-8');
    expect(written).toContain('export default function Anim');
    const sidecar = JSON.parse(await fs.readFile(job.versionPath!.replace(/\.tsx$/, '.debug.json'), 'utf-8'));
    expect(sidecar.prompt).toBe('a bouncing ball');
    expect(sidecar.transpileValid).toBe(true);
  });

  it('reserves suffixed folders when jobs collide on the same name', async () => {
    llmBehavior = defaultLlmBehavior('same-name');
    const a = tsxJobEngine.start({ kind: 'generate', prompt: 'anim one', options: GEN_OPTIONS });
    const b = tsxJobEngine.start({ kind: 'generate', prompt: 'anim two', options: GEN_OPTIONS });
    const [jobA, jobB] = await Promise.all([waitForJob(a.jobId!), waitForJob(b.jobId!)]);

    expect(jobA.status).toBe('done');
    expect(jobB.status).toBe('done');
    const names = [jobA.projectName, jobB.projectName].sort();
    expect(names).toEqual(['same-name', 'same-name-2']);
    expect(jobA.folderPath).not.toBe(jobB.folderPath);
  });

  it('caps concurrent jobs at maxConcurrent and queues the rest', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started = 0;
    llmBehavior = async (req) => {
      if (req.systemPrompt?.includes('project name')) return respond('cap-test');
      started++;
      await gate;
      return respond(TSX_OUTPUT);
    };

    const ids = Array.from({ length: 6 }, (_, i) =>
      tsxJobEngine.start({ kind: 'generate', prompt: `anim ${i}`, options: GEN_OPTIONS }).jobId!);

    // Give the first wave time to enter the LLM call
    await vi.waitFor(() => { expect(started).toBe(4); });
    const statuses = tsxJobEngine.list().filter((j) => ids.includes(j.id)).map((j) => j.status);
    expect(statuses.filter((s) => s === 'queued')).toHaveLength(2);

    release();
    const jobs = await Promise.all(ids.map((id) => waitForJob(id)));
    expect(jobs.every((j) => j.status === 'done')).toBe(true);
  });

  it('cancels a running job via its abort signal', async () => {
    let sawAbort = false;
    llmBehavior = (_req, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => {
        sawAbort = true;
        reject(new Error('Request cancelled'));
      });
    });

    const { jobId } = tsxJobEngine.start({ kind: 'generate', prompt: 'cancel me', options: GEN_OPTIONS });
    await vi.waitFor(() => { expect(llmCalls.length).toBeGreaterThan(0); });
    tsxJobEngine.cancel(jobId!);
    const job = await waitForJob(jobId!);

    expect(job.status).toBe('cancelled');
    expect(sawAbort).toBe(true);
  });

  it('cancels a queued job without running it', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    llmBehavior = async (req) => {
      if (req.systemPrompt?.includes('project name')) return respond('queue-cancel');
      await gate;
      return respond(TSX_OUTPUT);
    };

    const running = Array.from({ length: 4 }, (_, i) =>
      tsxJobEngine.start({ kind: 'generate', prompt: `blocker ${i}`, options: GEN_OPTIONS }).jobId!);
    const { jobId: queuedId } = tsxJobEngine.start({ kind: 'generate', prompt: 'queued', options: GEN_OPTIONS });

    const callsBefore = llmCalls.length;
    tsxJobEngine.cancel(queuedId!);
    const cancelled = await waitForJob(queuedId!);
    expect(cancelled.status).toBe('cancelled');

    release();
    await Promise.all(running.map((id) => waitForJob(id)));
    // The cancelled job never reached the LLM
    expect(llmCalls.slice(callsBefore).every((r) => !r.prompt.includes('queued') || r.systemPrompt?.includes('project name'))).toBe(true);
  });

  it('runs an edit job against an existing project and writes the next version', async () => {
    const folder = path.join(tmpDir, `edit-target-${Date.now()}`);
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, 'v1.tsx'), 'const original = 1;', 'utf-8');

    const { jobId } = tsxJobEngine.start({
      kind: 'edit',
      prompt: 'make it bigger',
      options: { maxFixRetries: 0 },
      target: { folderPath: folder, currentCode: 'const original = 1;' },
    });
    const job = await waitForJob(jobId!);

    expect(job.status).toBe('done');
    expect(job.folderPath).toBe(folder);
    expect(job.versionPath).toBe(path.join(folder, 'v2.tsx'));
  });

  it('rejects edit jobs without a target and empty prompts', () => {
    expect(tsxJobEngine.start({ kind: 'edit', prompt: 'x' }).error).toBeTruthy();
    expect(tsxJobEngine.start({ kind: 'generate', prompt: '   ' }).error).toBeTruthy();
  });

  it('marks a job as error when the generate step fails', async () => {
    llmBehavior = async () => ({ success: false, error: 'Invalid API key or expired session. Check your settings.' });
    const { jobId } = tsxJobEngine.start({ kind: 'generate', prompt: 'will fail', options: GEN_OPTIONS });
    const job = await waitForJob(jobId!);

    expect(job.status).toBe('error');
    expect(job.error).toContain('Invalid API key');
  });
});
