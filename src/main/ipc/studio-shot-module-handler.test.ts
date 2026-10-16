// The preview's shot module response carries a builder version's files
// (P3 part 6, D8) as asset-root URLs on the module server; a shot that names
// no files (every shot made before the builder) gets no `assets` at all.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { IpcMainInvokeEvent } from 'electron';

let shotsDir = '';

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => os.tmpdir() } }));
vi.mock('../services/module-server', () => ({
  ensureModuleServer: async () => undefined,
  getModuleServerBaseUrl: () => 'http://127.0.0.1:5555',
  storeTranspileResult: () => 'http://127.0.0.1:5555/modules/abc.js',
}));
vi.mock('../services/studio/shot-module-resolver', () => ({
  resolveShotModule: async () => ({
    success: true,
    source: 'transpile',
    config: { id: 'shot', durationInFrames: 60, fps: 30, width: 1920, height: 1080 },
  }),
}));
vi.mock('../services/studio/studio-paths', () => ({
  getShotVersionPath: async (_projectId: string, shotId: string, version: number) => path.join(shotsDir, shotId, `v${version}.tsx`),
}));

import { handleStudioShotModule } from './studio-shot-module-handler';
import { clearAssetRoots, resolveAssetRootRequest } from '../services/asset-roots';

const event = {} as IpcMainInvokeEvent;

beforeAll(async () => {
  shotsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-module-handler-'));
  await fs.mkdir(path.join(shotsDir, 'avocado', 'v1.assets'), { recursive: true });
  await fs.writeFile(path.join(shotsDir, 'avocado', 'v1.tsx'), "const m = staticFile('avocado.glb');", 'utf-8');
  await fs.writeFile(path.join(shotsDir, 'avocado', 'v1.assets', 'avocado.glb'), 'glb');
  await fs.mkdir(path.join(shotsDir, 'title'), { recursive: true });
  await fs.writeFile(path.join(shotsDir, 'title', 'v1.tsx'), 'export default () => null;', 'utf-8');
});

afterAll(async () => {
  clearAssetRoots();
  await fs.rm(shotsDir, { recursive: true, force: true });
});

describe('handleStudioShotModule', () => {
  it("returns the version's files as module-server URLs, their folder registered", async () => {
    clearAssetRoots();
    const res = await handleStudioShotModule(event, { projectId: 'p1', shotId: 'avocado', version: 1 });
    expect(res.success).toBe(true);
    expect(res.moduleUrl).toBe('http://127.0.0.1:5555/modules/abc.js');
    const url = res.assets?.avocado ?? '';
    const match = /^http:\/\/127\.0\.0\.1:5555\/asset-root\/([0-9a-f]{16})\/avocado\.glb$/.exec(url);
    expect(match).not.toBeNull();
    expect(resolveAssetRootRequest(match![1], 'avocado.glb')).toEqual({ file: path.join(shotsDir, 'avocado', 'v1.assets', 'avocado.glb') });
  });

  it('adds no assets for a shot whose code names no files', async () => {
    const res = await handleStudioShotModule(event, { projectId: 'p1', shotId: 'title', version: 1 });
    expect(res.success).toBe(true);
    expect(res).not.toHaveProperty('assets');
  });
});
