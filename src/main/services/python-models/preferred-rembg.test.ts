import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/paths', () => ({
  getPythonModelsRoot: () => 'C:\\unused',
  getPipelinesDir: () => 'C:\\unused',
  getPythonRequestsDir: () => 'C:\\unused',
}));
vi.mock('../download-manager', () => ({ getAllDownloads: () => [], enqueueDownload: vi.fn(), cancelDownload: vi.fn(), onDownloadProgress: vi.fn() }));
vi.mock('../ai-runtime', () => ({
  AI_RUNTIME_CATALOGUE: {},
  AI_RUNTIME_VERSION: '2026.09.1',
  formatRuntimeBytes: () => '',
  getAiRuntimeStatus: vi.fn(),
  getInstalledAiRuntime: vi.fn(),
  installAiRuntime: vi.fn(),
  repairAiRuntime: vi.fn(),
  computeAiRuntimeState: () => 'missing',
  isAiRuntimeInstalling: () => false,
  scanInstalledRuntime: vi.fn(),
}));
vi.mock('../system-info', () => ({ getPreflightHardware: vi.fn() }));
vi.mock('../model-usage', () => ({ usageStore: { recordUse: vi.fn() } }));
vi.mock('../../../logging/log-engine', () => ({ logEngine: { createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) } }));

import { preferredRembgModelId } from './service';
import { pythonModelById } from './registry';

describe('preferredRembgModelId', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-rembg-'));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('is u2net when the ISNet weights are absent or the wrong size', async () => {
    expect(await preferredRembgModelId(root)).toBe('rembg-u2net');
    const file = pythonModelById('rembg-isnet')!.files[0];
    const abs = path.join(root, ...file.dest.split('/'));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, Buffer.alloc(10)); // a .part-sized stub never counts
    expect(await preferredRembgModelId(root)).toBe('rembg-u2net');
  });

  it('is ISNet once its file is present at the catalogue byte count', async () => {
    const file = pythonModelById('rembg-isnet')!.files[0];
    const abs = path.join(root, ...file.dest.split('/'));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const fh = await fs.open(abs, 'w');
    await fh.truncate(file.bytes); // sparse file with the exact size
    await fh.close();
    expect(await preferredRembgModelId(root)).toBe('rembg-isnet');
  });
});
