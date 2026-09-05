import { describe, expect, it, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

/**
 * Install flow with the download engine, GPU probe and Python selftests mocked — no
 * Electron, no network, no Python. Proves: inflight idempotence, staging → atomic
 * reveal, manifest mismatch cleanup, and remove.
 */
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-runtime-install-test-'));

vi.mock('../../utils/paths', () => ({
  getAiRuntimeRoot: () => tmpRoot,
  getAiRuntimeDir: (version: string, variant: string) => path.join(tmpRoot, `${version}-${variant}`),
  getPipelinesDir: () => path.join(tmpRoot, 'pipelines'),
}));
vi.mock('../../../logging/log-engine', () => ({
  logEngine: { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) },
}));
vi.mock('./gpu', () => ({ getGpuFacts: async () => null }));

const enqueueDownload = vi.fn();
const cancelDownload = vi.fn();
vi.mock('../download-manager', () => ({
  enqueueDownload: (...args: unknown[]) => enqueueDownload(...args),
  cancelDownload: (...args: unknown[]) => cancelDownload(...args),
  getAllDownloads: () => [],
}));

let selftestTorch = '2.14.0+cpu';
const selftestCalls: string[] = [];
vi.mock('./selftest', () => ({
  runPipelineSelftest: async (_py: string, _dir: string, pipeline: string, opts?: { mode?: string }) => {
    selftestCalls.push(`${pipeline}:${opts?.mode ?? 'selftest'}`);
    return { ready: { type: 'ready', torch: pipeline === 'rembg' ? null : selftestTorch, cuda: false, device: 'cpu', vramMb: 0 }, ms: 1, stderrTail: '' };
  },
}));

const { installAiRuntime, removeAiRuntime, isAiRuntimeInstalling } = await import('./install');
const { scanInstalledRuntime, isAiRuntimeAvailable } = await import('./status');
const { AI_RUNTIME_VERSION } = await import('./catalogue');

interface EnqueueOpts { extraction: { destDir: string }; metadata: Record<string, string> }

let manifestVariant = 'cpu';
/** Pretend the engine downloaded + extracted the zip: write a manifest and a fake python.exe. */
async function fakeExtract(opts: EnqueueOpts): Promise<void> {
  const dir = opts.extraction.destDir;
  await fs.mkdir(path.join(dir, 'python'), { recursive: true });
  await fs.writeFile(path.join(dir, 'python', 'python.exe'), 'fake');
  await fs.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      schema: 1, name: `${AI_RUNTIME_VERSION}-${manifestVariant}`, version: AI_RUNTIME_VERSION, variant: manifestVariant,
      python: '3.11.15', torch: '2.14.0+cpu', cuda: null, minDriver: null, maxRelativePathLength: 126,
      bytesOnDisk: 10, files: 2, pythonDir: 'python',
    }),
  );
}

beforeEach(async () => {
  enqueueDownload.mockReset();
  enqueueDownload.mockImplementation(fakeExtract);
  selftestCalls.length = 0;
  selftestTorch = '2.14.0+cpu';
  manifestVariant = 'cpu';
  await fs.rm(tmpRoot, { recursive: true, force: true });
  await fs.mkdir(tmpRoot, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('installAiRuntime', () => {
  it('downloads once, verifies + warms up, and reveals <version>-cpu atomically', async () => {
    const p1 = installAiRuntime();
    const p2 = installAiRuntime({ variant: 'cu126' }); // joins the inflight install, does not start a second
    expect(isAiRuntimeInstalling()).toBe(true);
    expect(p2).toBe(p1);
    await p1;

    expect(enqueueDownload).toHaveBeenCalledTimes(1);
    const opts = enqueueDownload.mock.calls[0][0] as EnqueueOpts & { id: string; sha256: string; mirrors: string[] };
    expect(opts.id).toBe('ai-runtime-cpu');
    expect(opts.metadata).toMatchObject({ type: 'ai-runtime', variant: 'cpu', version: AI_RUNTIME_VERSION });
    expect(opts.extraction.destDir.endsWith('.tmp')).toBe(true);
    expect(opts.sha256).toMatch(/^[0-9a-f]{64}$/);

    const finalDir = path.join(tmpRoot, `${AI_RUNTIME_VERSION}-cpu`);
    expect(existsSync(path.join(finalDir, 'manifest.json'))).toBe(true);
    expect(existsSync(`${finalDir}.tmp`)).toBe(false);
    expect(selftestCalls).toEqual(['triposr:selftest', 'rembg:selftest', 'triposr:warmup']);
    expect(isAiRuntimeInstalling()).toBe(false);

    const scan = await scanInstalledRuntime();
    expect(scan.kind).toBe('installed');
    expect(await isAiRuntimeAvailable()).toBe(true);
  });

  it('a second install of the same version only re-verifies (no download)', async () => {
    await installAiRuntime();
    enqueueDownload.mockClear();
    await installAiRuntime();
    expect(enqueueDownload).not.toHaveBeenCalled();
  });

  it('repair re-downloads even when installed', async () => {
    await installAiRuntime();
    enqueueDownload.mockClear();
    await installAiRuntime({ repair: true });
    expect(enqueueDownload).toHaveBeenCalledTimes(1);
  });

  it('rejects and removes staging when the manifest is not the runtime we asked for', async () => {
    manifestVariant = 'cu126'; // zip says cu126, we asked for cpu
    await expect(installAiRuntime()).rejects.toThrow(/expected 2026\.\d{2}\.\d+-cpu/);
    expect(existsSync(path.join(tmpRoot, `${AI_RUNTIME_VERSION}-cpu.tmp`))).toBe(false);
    expect(existsSync(path.join(tmpRoot, `${AI_RUNTIME_VERSION}-cpu`))).toBe(false);
    expect((await scanInstalledRuntime()).kind).toBe('none');
  });

  it('rejects when the selftest reports a different torch build', async () => {
    selftestTorch = '2.13.0+cpu';
    await expect(installAiRuntime()).rejects.toThrow(/torch 2\.13\.0\+cpu, expected 2\.14\.0\+cpu/);
  });

  it('removes old version folders after a successful install', async () => {
    const old = path.join(tmpRoot, '2026.08.3-cpu');
    await fs.mkdir(path.join(old, 'python'), { recursive: true });
    await installAiRuntime();
    expect(existsSync(old)).toBe(false);
  });

  it('removeAiRuntime deletes everything under the root', async () => {
    await installAiRuntime();
    await removeAiRuntime();
    expect(await fs.readdir(tmpRoot)).toEqual([]);
    expect((await scanInstalledRuntime()).kind).toBe('none');
  });

  it('a folder without manifest.json scans as broken', async () => {
    await fs.mkdir(path.join(tmpRoot, `${AI_RUNTIME_VERSION}-cu126`, 'python'), { recursive: true });
    const scan = await scanInstalledRuntime();
    expect(scan.kind).toBe('broken');
  });
});
