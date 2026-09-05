import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { PythonLocalEngine } from './python-engine';
import { PythonRunError } from './python-failure';
import type { PythonJobProgress, PythonRunOptions } from './types';

/** Serial queue semantics against the mock runner: order, progress fan-out, cancel queued/running, errors. */
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(here, 'mock-runner.cjs');
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'py-engine-test-'));
});
afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function opts(mock: Record<string, unknown>, extra: Partial<PythonRunOptions> = {}): PythonRunOptions {
  return {
    python: process.execPath,
    runnerPath: MOCK,
    requestDir: path.join(tmp, 'requests'),
    request: { outputPath: path.join(tmp, `out-${Math.random().toString(36).slice(2)}.bin`), mock },
    ...extra,
  };
}

describe('PythonLocalEngine', () => {
  it('runs jobs one at a time, in submission order, and fans out progress per requestId', async () => {
    const engine = new PythonLocalEngine();
    const progress: PythonJobProgress[] = [];
    engine.onProgress = (p) => progress.push(p);
    const order: string[] = [];

    const a = engine.run(opts({ script: [{ type: 'stage', name: 'a1', delayMs: 60 }, { type: 'result' }] }));
    const b = engine.run(opts({ script: [{ type: 'stage', name: 'b1' }, { type: 'result' }] }));
    expect(engine.pending().map((p) => p.status)).toEqual(['running', 'queued']);

    await Promise.all([
      a.promise.then(() => order.push('a')),
      b.promise.then(() => order.push('b')),
    ]);
    expect(order).toEqual(['a', 'b']);
    const stagesA = progress.filter((p) => p.requestId === a.requestId).map((p) => p.stage);
    const stagesB = progress.filter((p) => p.requestId === b.requestId).map((p) => p.stage);
    expect(stagesA).toEqual(['starting', 'ready', 'a1']);
    expect(stagesB).toEqual(['starting', 'ready', 'b1']);
    // b's 'starting' came after a finished
    const aIdx = progress.findIndex((p) => p.requestId === a.requestId && p.stage === 'a1');
    const bIdx = progress.findIndex((p) => p.requestId === b.requestId && p.stage === 'starting');
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(engine.pending()).toEqual([]);
  });

  it('cancelling a queued job rejects it immediately without touching the running one', async () => {
    const engine = new PythonLocalEngine();
    const a = engine.run(opts({ script: [{ type: 'stage', name: 'a1', delayMs: 80 }, { type: 'result' }] }));
    const b = engine.run(opts({}));
    expect(engine.cancel(b.requestId)).toBe(true);
    const err = await b.promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('cancelled');
    await expect(a.promise).resolves.toMatchObject({ exitCode: 0 });
  });

  it('cancelling the running job kills it and lets the next job start', async () => {
    const engine = new PythonLocalEngine();
    const stages: string[] = [];
    const ids: Record<string, string> = {};
    engine.onProgress = (p) => stages.push(`${ids[p.requestId] ?? '?'}:${p.stage}`);
    const a = engine.run(opts({ hang: true }));
    ids[a.requestId] = 'a';
    const b = engine.run(opts({}));
    ids[b.requestId] = 'b';
    await new Promise<void>((resolve) => {
      const t = setInterval(() => { if (stages.includes('a:ready')) { clearInterval(t); resolve(); } }, 10);
    });
    expect(engine.cancel(a.requestId)).toBe(true);
    const err = await a.promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('cancelled');
    await expect(b.promise).resolves.toMatchObject({ exitCode: 0 });
    expect(stages).toContain('b:ready');
  }, 15_000);

  it('an AbortSignal on the options cancels too', async () => {
    const engine = new PythonLocalEngine();
    const controller = new AbortController();
    const a = engine.run(opts({ hang: true }, { signal: controller.signal }));
    await new Promise((r) => setTimeout(r, 150));
    controller.abort();
    const err = await a.promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('cancelled');
  }, 15_000);

  it('a failed job rejects with the classified error and the queue keeps going', async () => {
    const engine = new PythonLocalEngine();
    const a = engine.run(opts({ script: [{ type: 'error', code: 'oom', message: 'Ran out of memory (GPU).' }] }));
    const b = engine.run(opts({}));
    const err = await a.promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PythonRunError);
    expect((err as PythonRunError).code).toBe('oom');
    await expect(b.promise).resolves.toMatchObject({ exitCode: 0 });
    expect(engine.isBusy()).toBe(false);
  });

  it('cancel on an unknown id is a no-op', () => {
    const engine = new PythonLocalEngine();
    expect(engine.cancel('nope')).toBe(false);
  });
});
