import { beforeEach, describe, expect, it, vi } from 'vitest';

type RunReq = { signal?: AbortSignal; shotId: string };
const { edit, refine } = vi.hoisted(() => ({
  edit: vi.fn<(req: RunReq) => Promise<unknown>>(),
  refine: vi.fn<(req: RunReq) => Promise<unknown>>(),
}));

vi.mock('electron', () => ({ dialog: {} }));
vi.mock('../services/studio/shot-generator', () => ({ shotGenerator: { edit, refine, generate: vi.fn() } }));
vi.mock('../services/studio/studio-paths', () => ({ getProjectDir: vi.fn() }));
vi.mock('../services/studio/shot-module-resolver', () => ({ resolveShotModule: vi.fn() }));
vi.mock('../services/studio/creator-projects', () => ({ listCreatorProjects: vi.fn() }));
vi.mock('../services/studio/shot-import', () => ({ importShot: vi.fn() }));
vi.mock('../services/studio/shot-reconcile', () => ({ reconcileShots: vi.fn() }));
vi.mock('../services/studio/studio-shot-library', () => ({ listStudioShotLibrary: vi.fn() }));
vi.mock('../utils/paths', () => ({ getProjectsDir: vi.fn() }));
vi.mock('../services/module-server', () => ({
  ensureModuleServer: vi.fn(),
  getModuleServerBaseUrl: vi.fn(),
  storeTranspileResult: vi.fn(),
}));

import type { IpcMainInvokeEvent } from 'electron';
import { handleStudioShotCancel, handleStudioShotGenerate } from './studio-shot-handlers';

const ev = {} as IpcMainInvokeEvent;

beforeEach(() => {
  edit.mockReset();
  refine.mockReset();
});

describe('shot cancel', () => {
  it('aborts the signal handed to a running refine', async () => {
    let seen: AbortSignal | undefined;
    let finish: () => void = () => {};
    refine.mockImplementation((req) => {
      seen = req.signal;
      return new Promise((resolve) => (finish = () => resolve(undefined)));
    });

    const started = await handleStudioShotGenerate(ev, {
      projectId: 'p1', op: 'refine', shotId: 's1', activeVersion: 2,
    } as never);
    expect(started.success).toBe(true);
    expect(seen?.aborted).toBe(false);

    const res = await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 's1' });
    expect(res).toEqual({ success: true, cancelled: true });
    expect(seen?.aborted).toBe(true);

    finish();
    await new Promise((r) => setTimeout(r, 0));
    // The run is untracked once it settles.
    expect(await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 's1' })).toEqual({
      success: true,
      cancelled: false,
    });
  });

  it('reports nothing to cancel for a shot with no run', async () => {
    expect(await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 'nope' })).toEqual({
      success: true,
      cancelled: false,
    });
  });

  it('keys runs per project and shot', async () => {
    edit.mockImplementation(() => new Promise(() => {}));
    await handleStudioShotGenerate(ev, {
      projectId: 'p1', op: 'edit', shotId: 's1', activeVersion: 1, instruction: 'x',
    } as never);
    expect((await handleStudioShotCancel(ev, { projectId: 'p2', shotId: 's1' })).cancelled).toBe(false);
    expect((await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 's1' })).cancelled).toBe(true);
  });
});
