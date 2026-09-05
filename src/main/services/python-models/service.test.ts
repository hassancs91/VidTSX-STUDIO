import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The shared service end to end against mock-runner.cjs: preflight verdicts (runtime /
 * model missing → structured not-ready with an install action), the run path (request
 * file → worker → output → sidecar), progress fan-out, cancel, and the classified error.
 * Paths, runtime status, downloads and hardware are mocked — no Electron, no Python.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = path.join(here, '..', '..', '..', 'local-python-engine', 'mock-runner.cjs');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pymodel-service-test-'));
const modelsRoot = path.join(tmp, 'models');
const pipelinesDir = path.join(tmp, 'pipelines');

vi.mock('../../utils/paths', () => ({
  getPythonModelsRoot: () => modelsRoot,
  getPythonRequestsDir: () => path.join(tmp, 'requests'),
  getPipelinesDir: () => pipelinesDir,
}));
vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));
vi.mock('../download-manager', () => ({
  getAllDownloads: () => [],
  enqueueDownload: vi.fn(async () => {}),
  cancelDownload: vi.fn(),
}));
vi.mock('../system-info', () => ({ getPreflightHardware: async () => ({ vramGB: 4, ramGB: 16 }) }));
vi.mock('../model-usage', () => ({ usageStore: { recordUse: vi.fn() } }));

type Scan = { kind: 'none' } | { kind: 'installed'; info: { version: string; variant: 'cpu' | 'cu126'; dir: string; python: string; torch: string; bytesOnDisk: number } };
let scan: Scan = { kind: 'none' };
const installAiRuntime = vi.fn(async () => { scan = installedScan('cpu'); });
vi.mock('../ai-runtime', async () => {
  const actual = await vi.importActual<typeof import('../ai-runtime/catalogue')>('../ai-runtime/catalogue');
  const status = await vi.importActual<typeof import('../ai-runtime/status')>('../ai-runtime/status');
  return {
    AI_RUNTIME_CATALOGUE: actual.AI_RUNTIME_CATALOGUE,
    AI_RUNTIME_VERSION: actual.AI_RUNTIME_VERSION,
    formatRuntimeBytes: actual.formatRuntimeBytes,
    computeAiRuntimeState: status.computeAiRuntimeState,
    scanInstalledRuntime: async () => scan,
    isAiRuntimeInstalling: () => false,
    getInstalledAiRuntime: async () => (scan.kind === 'installed' ? scan.info : null),
    getAiRuntimeStatus: async () => ({
      recommendedVariant: 'cpu',
      variants: { cpu: { variant: 'cpu', bytes: actual.AI_RUNTIME_CATALOGUE.cpu.bytes, sizeLabel: '280 MB', issue: null }, cu126: { variant: 'cu126', bytes: 1, sizeLabel: '2.8 GB', issue: { code: 'gpu-unsupported', message: 'no gpu' } } },
    }),
    installAiRuntime,
    repairAiRuntime: vi.fn(),
  };
});

const { AI_RUNTIME_VERSION } = await import('../ai-runtime/catalogue');
const { preflightPythonModel, startPythonModel, runPythonModel, ensurePythonModelReady, cancelPythonModelRun, PythonModelNotReadyError } = await import('./service');
const { pythonModelById } = await import('./registry');
const download = await import('./download');
const { PythonRunError } = await import('../../../local-python-engine');

function installedScan(variant: 'cpu' | 'cu126'): Scan {
  return { kind: 'installed', info: { version: AI_RUNTIME_VERSION, variant, dir: tmp, python: process.execPath, torch: '2.14.0+cpu', bytesOnDisk: 1 } };
}

/** Write every catalogue file at its exact byte size (content is irrelevant to the mock). */
async function seedModel(id: string): Promise<void> {
  const profile = pythonModelById(id)!;
  const { pythonModelAllFiles } = await import('./registry');
  for (const f of pythonModelAllFiles(profile)) {
    const abs = path.join(modelsRoot, ...f.dest.split('/'));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const fh = await fs.open(abs, 'w');
    await fh.truncate(f.bytes);
    await fh.close();
  }
}

/** Put the mock runner where the service expects `<pipelines>/rembg/runner.py`. */
async function seedPipelines(): Promise<void> {
  for (const p of ['rembg', 'triposr']) {
    await fs.mkdir(path.join(pipelinesDir, p), { recursive: true });
    await fs.copyFile(MOCK, path.join(pipelinesDir, p, 'runner.py'));
  }
}

const inputImage = path.join(tmp, 'in', 'photo.jpg');

beforeEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.dirname(inputImage), { recursive: true });
  await fs.writeFile(inputImage, 'jpeg-bytes');
  await seedPipelines();
  scan = { kind: 'none' };
  installAiRuntime.mockClear();
});
afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('preflightPythonModel', () => {
  it('runtime + model missing → install-runtime-and-model with both sizes in the label', async () => {
    const pre = await preflightPythonModel('rembg-u2net');
    expect(pre.ready).toBe(false);
    if (pre.ready) return;
    expect(pre.reason).toBe('runtime-missing');
    expect(pre.action).toMatchObject({ kind: 'install-runtime-and-model', variant: 'cpu', modelBytes: 175_997_641 });
    expect(pre.action?.label).toMatch(/AI runtime \(280 MB\).*model \(176 MB\)/);
    expect(pre.message).toMatch(/Download the AI runtime \(280 MB\) and the model \(176 MB\)\?/);
  });

  it('runtime installed, model missing → download-model', async () => {
    scan = installedScan('cpu');
    const pre = await preflightPythonModel('rembg-u2net');
    expect(pre).toMatchObject({ ready: false, reason: 'model-missing', action: { kind: 'download-model' } });
  });

  it('model present, runtime missing → install-runtime only', async () => {
    await seedModel('rembg-u2net');
    const pre = await preflightPythonModel('rembg-u2net');
    expect(pre).toMatchObject({ ready: false, reason: 'runtime-missing', action: { kind: 'install-runtime', modelBytes: 0 } });
  });

  it('both present → ready, device cpu for rembg even on a GPU runtime', async () => {
    await seedModel('rembg-u2net');
    scan = installedScan('cu126');
    expect(await preflightPythonModel('rembg-u2net')).toEqual({ ready: true, modelId: 'rembg-u2net', device: 'cpu', runtimeVariant: 'cu126' });
    await seedModel('triposr');
    expect(await preflightPythonModel('triposr')).toMatchObject({ ready: true, device: 'gpu' });
  });

  it('a file with the wrong size counts as missing', async () => {
    await seedModel('rembg-u2net');
    scan = installedScan('cpu');
    await fs.writeFile(path.join(modelsRoot, 'rembg', 'models', 'u2net', 'u2net.onnx'), 'truncated');
    expect((await preflightPythonModel('rembg-u2net')).ready).toBe(false);
  });
});

describe('ensurePythonModelReady', () => {
  it('installs the runtime, then downloads the model, then is ready', async () => {
    const spy = vi.spyOn(download, 'downloadPythonModel').mockImplementation(async (id) => { await seedModel(id); });
    await ensurePythonModelReady('rembg-u2net');
    expect(installAiRuntime).toHaveBeenCalledWith({ variant: 'cpu' });
    expect(spy).toHaveBeenCalledWith('rembg-u2net');
    expect((await preflightPythonModel('rembg-u2net')).ready).toBe(true);
    spy.mockRestore();
  });
});

describe('runPythonModel', () => {
  it('refuses with a structured error before spawning when not ready', async () => {
    const err = await runPythonModel({ modelId: 'rembg-u2net', input: { imagePath: inputImage }, outputDir: path.join(tmp, 'out') }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PythonModelNotReadyError);
    expect((err as InstanceType<typeof PythonModelNotReadyError>).preflight.reason).toBe('runtime-missing');
  });

  it('runs the worker, names the output <stem>-nobg.png, writes the sidecar, reports stages', async () => {
    await seedModel('rembg-u2net');
    scan = installedScan('cpu');
    const stages: string[] = [];
    const result = await runPythonModel({
      modelId: 'rembg-u2net',
      input: { imagePath: inputImage },
      options: { alphaMatting: true },
      outputDir: path.join(tmp, 'out'),
      source: { imageStudioId: 'abc' },
      onProgress: (e) => stages.push(e.stage),
    });
    expect(result.outputPath).toBe(path.join(tmp, 'out', 'photo-nobg.png'));
    expect(existsSync(result.outputPath)).toBe(true);
    expect(stages).toEqual(['starting', 'ready', 'load-model', 'process', 'process', 'process', 'export']);
    const sidecar = JSON.parse(await fs.readFile(result.sidecarPath, 'utf8'));
    expect(sidecar).toMatchObject({
      schema: 1, modelId: 'rembg-u2net', pipeline: 'rembg', toolId: 'remove_background',
      runtime: { version: AI_RUNTIME_VERSION, variant: 'cpu' },
      options: { alphaMatting: true }, input: { imagePath: inputImage }, source: { imageStudioId: 'abc' },
    });
    expect(sidecar.stats.mock).toBe(true);
    // the worker received the request the builder made (offline env, cpu)
    expect(sidecar.stats.env).toEqual({ cuda: null, offline: '1' });
    // a second run does not overwrite: -2
    const again = await runPythonModel({ modelId: 'rembg-u2net', input: { imagePath: inputImage }, outputDir: path.join(tmp, 'out') });
    expect(again.outputPath).toBe(path.join(tmp, 'out', 'photo-nobg-2.png'));
  });

  it('forces CUDA_VISIBLE_DEVICES=-1 when options.device is cpu on a GPU runtime', async () => {
    await seedModel('triposr');
    scan = installedScan('cu126');
    const result = await runPythonModel({ modelId: 'triposr', input: { imagePath: inputImage }, options: { device: 'cpu' }, outputDir: path.join(tmp, 'out') });
    expect(result.outputPath).toBe(path.join(tmp, 'out', 'photo-3d.glb'));
    expect(result.stats.env).toEqual({ cuda: '-1', offline: '1' });
  });

  it('a worker error surfaces as a classified PythonRunError and no sidecar is written', async () => {
    await seedModel('rembg-u2net');
    scan = installedScan('cpu');
    // The mock reads `mock` from the request; the builder does not pass one, so drive
    // the failure through a runner that always errors.
    await fs.writeFile(
      path.join(pipelinesDir, 'rembg', 'runner.py'),
      (await fs.readFile(MOCK, 'utf8')).replace('const mock = request.mock ?? {};', "const mock = { script: [{ type: 'error', code: 'weights-corrupt', message: 'central directory' }] };"),
    );
    const err = await runPythonModel({ modelId: 'rembg-u2net', input: { imagePath: inputImage }, outputDir: path.join(tmp, 'out') }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PythonRunError);
    expect((err as InstanceType<typeof PythonRunError>).code).toBe('weights-corrupt');
    expect(existsSync(path.join(tmp, 'out', 'photo-nobg.json'))).toBe(false);
  });

  it('cancel by requestId rejects with cancelled', async () => {
    await seedModel('rembg-u2net');
    scan = installedScan('cpu');
    await fs.writeFile(
      path.join(pipelinesDir, 'rembg', 'runner.py'),
      (await fs.readFile(MOCK, 'utf8')).replace('const mock = request.mock ?? {};', 'const mock = { hang: true };'),
    );
    const started = await startPythonModel({ modelId: 'rembg-u2net', input: { imagePath: inputImage }, outputDir: path.join(tmp, 'out') });
    await new Promise((r) => setTimeout(r, 300));
    expect(cancelPythonModelRun(started.requestId)).toBe(true);
    const err = await started.promise.catch((e: unknown) => e);
    expect((err as InstanceType<typeof PythonRunError>).code).toBe('cancelled');
  }, 15_000);
});
