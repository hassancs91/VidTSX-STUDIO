import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildWorkerEnv, runPipeline } from './python-runner';
import { PythonRunError } from './python-failure';
import type { PythonProtocolEvent } from './types';

/**
 * The runner against mock-runner.cjs (node, no Python): event order, output creation,
 * partial-line reassembly, error line → typed error, cancel = tree kill, exit-code mapping.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(here, 'mock-runner.cjs');
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'py-runner-test-'));
});
afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function run(mock: Record<string, unknown>, extra: Partial<Parameters<typeof runPipeline>[0]> = {}) {
  const events: PythonProtocolEvent[] = [];
  const outputPath = path.join(tmp, `out-${Math.random().toString(36).slice(2)}.png`);
  const promise = runPipeline({
    python: process.execPath,
    runnerPath: MOCK,
    requestDir: path.join(tmp, 'requests'),
    request: { outputPath, mock },
    onEvent: (e) => events.push(e),
    ...extra,
  });
  return { promise, events, outputPath };
}

describe('buildWorkerEnv', () => {
  it('sets the offline + UTF-8 variables and CUDA_VISIBLE_DEVICES=-1 only when forcing CPU', () => {
    const base = { PATH: 'x' };
    const gpu = buildWorkerEnv(base, false);
    expect(gpu).toMatchObject({ PATH: 'x', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', PYTHONUTF8: '1' });
    expect('CUDA_VISIBLE_DEVICES' in gpu).toBe(false);
    const cpu = buildWorkerEnv(base, true);
    expect(cpu.CUDA_VISIBLE_DEVICES).toBe('-1'); // never '' — Win32 drops empty values
  });
});

describe('runPipeline (mock runner)', () => {
  it('delivers ready → stages → progress → result in order and creates the output', async () => {
    const { promise, events, outputPath } = run({});
    const result = await promise;
    expect(events.map((e) => e.type)).toEqual(['ready', 'stage', 'stage', 'progress', 'progress', 'stage', 'result']);
    expect(result.outputPath).toBe(outputPath);
    expect(existsSync(outputPath)).toBe(true);
    expect(result.ready?.device).toBe('mock');
    expect(result.stats).toMatchObject({ mock: true, env: { offline: '1', cuda: null } });
    expect(result.exitCode).toBe(0);
    // the temp request file is removed afterwards
    expect(await fs.readdir(path.join(tmp, 'requests'))).toEqual([]);
  });

  it('forceCpu reaches the worker as CUDA_VISIBLE_DEVICES=-1', async () => {
    const { promise } = run({}, { forceCpu: true });
    const result = await promise;
    expect(result.stats).toMatchObject({ env: { cuda: '-1' } });
  });

  it('survives stdout noise and a result line split across chunks', async () => {
    const { promise, events } = run({ noise: true, split: true });
    await promise;
    expect(events.filter((e) => e.type === 'result')).toHaveLength(1);
  });

  it('turns a protocol error line into a typed PythonRunError with the stderr tail', async () => {
    const { promise } = run({ script: [{ type: 'stage', name: 'load-model' }, { type: 'error', code: 'weights-corrupt', message: 'central directory not found' }], stderr: 'Traceback…' });
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PythonRunError);
    const e = err as PythonRunError;
    expect(e.code).toBe('weights-corrupt');
    expect(e.message).toMatch(/central directory/);
    expect(e.details).toMatch(/Traceback/);
  });

  it('exit 0 without a result is no-result; a non-zero exit without an error line is exit', async () => {
    const a = await run({ script: [{ type: 'stage', name: 'x' }] }).promise.catch((e: PythonRunError) => e);
    expect((a as PythonRunError).code).toBe('no-result');
    const b = await run({ script: [{ type: 'stage', name: 'x' }], exitCode: 3 }).promise.catch((e: PythonRunError) => e);
    expect((b as PythonRunError).code).toBe('exit');
    expect((b as PythonRunError).message).toMatch(/code 3/);
  });

  it('cancel through the AbortSignal kills the worker tree and rejects with cancelled', async () => {
    const controller = new AbortController();
    const { promise, events } = run({ hang: true }, { signal: controller.signal });
    // wait for ready, then cancel
    await new Promise<void>((resolve) => {
      const tick = setInterval(() => {
        if (events.some((e) => e.type === 'ready')) { clearInterval(tick); resolve(); }
      }, 10);
    });
    const t0 = Date.now();
    controller.abort();
    const err = await promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('cancelled');
    expect(Date.now() - t0).toBeLessThan(5000);
  }, 15_000);

  it('an already-aborted signal never spawns', async () => {
    const controller = new AbortController();
    controller.abort();
    const err = await run({}, { signal: controller.signal }).promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('cancelled');
  });

  it('idle timeout kills a silent worker', async () => {
    const err = await run({ hang: true }, { idleTimeoutMs: 300 }).promise.catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('timeout');
  }, 10_000);

  it('a missing interpreter is a spawn failure', async () => {
    const err = await runPipeline({
      python: path.join(tmp, 'missing', 'python.exe'),
      runnerPath: MOCK,
      requestDir: path.join(tmp, 'requests'),
      request: {},
    }).catch((e: unknown) => e);
    expect((err as PythonRunError).code).toBe('spawn');
  });
});
