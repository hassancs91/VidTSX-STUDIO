// The shot IPC on the TSX builder (P3 part 5): the generator owns one run per
// shot, so Cancel reaches every op whoever started it; the handshake passes
// the Inspector's budget, the registry's facts and the footage under the clip.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { edit, refine, generate, cancel, isRunning } = vi.hoisted(() => ({
  edit: vi.fn<(req: Record<string, unknown>) => Promise<unknown>>(),
  refine: vi.fn<(req: Record<string, unknown>) => Promise<unknown>>(),
  generate: vi.fn<(req: Record<string, unknown> & { onReserved?: (id: string) => void }, existing?: string) => Promise<unknown>>(),
  cancel: vi.fn<(projectId: string, shotId: string) => boolean>(),
  isRunning: vi.fn<(projectId: string, shotId: string) => boolean>(),
}));

vi.mock('electron', () => ({ dialog: {} }));
vi.mock('../services/studio/shot-generator', () => ({ shotGenerator: { edit, refine, generate, cancel, isRunning } }));
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
  for (const fn of [edit, refine, generate, cancel, isRunning]) fn.mockReset();
  edit.mockResolvedValue({});
  refine.mockResolvedValue({});
  isRunning.mockReturnValue(false);
});

describe('shot cancel', () => {
  it('asks the generator, which owns every run', async () => {
    cancel.mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 's1' })).toEqual({ success: true, cancelled: true });
    expect(await handleStudioShotCancel(ev, { projectId: 'p1', shotId: 's1' })).toEqual({ success: true, cancelled: false });
    expect(cancel).toHaveBeenCalledWith('p1', 's1');
  });
});

describe('shot ops', () => {
  const footage = { assetId: 'talk', sourceSeconds: 12 };

  it('starts an edit with the budget, the registry facts and the footage, and returns at once', async () => {
    edit.mockReturnValue(new Promise(() => {}));
    const res = await handleStudioShotGenerate(ev, {
      projectId: 'p1', op: 'edit', shotId: 's1', activeVersion: 2, instruction: 'Amber.', budget: 'craft',
      kind: 'overlay', brief: 'Badge.', assetRefs: { logo: 'a1' }, footage, model: 'claude-sonnet-5-5',
    });
    expect(res).toEqual({ success: true, shotId: 's1' });
    expect(edit).toHaveBeenCalledWith({
      projectId: 'p1', shotId: 's1', activeVersion: 2, instruction: 'Amber.', budget: 'craft',
      kind: 'overlay', brief: 'Badge.', assetRefs: { logo: 'a1' }, footage, model: 'claude-sonnet-5-5',
    });
  });

  it('starts a refine with no budget of its own (it is always Quick)', async () => {
    await handleStudioShotGenerate(ev, { projectId: 'p1', op: 'refine', shotId: 's1', activeVersion: 1, budget: 'craft', kind: 'cutaway' });
    expect(refine).toHaveBeenCalledWith({ projectId: 'p1', shotId: 's1', activeVersion: 1, kind: 'cutaway' });
  });

  it('refuses an op on a shot that is already building, and an edit with no instruction', async () => {
    isRunning.mockReturnValue(true);
    expect(await handleStudioShotGenerate(ev, { projectId: 'p1', op: 'refine', shotId: 's1', activeVersion: 1 })).toEqual({
      success: false,
      error: 'This shot is already building: wait for it, or cancel it first.',
    });
    isRunning.mockReturnValue(false);
    expect((await handleStudioShotGenerate(ev, { projectId: 'p1', op: 'edit', shotId: 's1', activeVersion: 1, instruction: ' ' })).success).toBe(false);
    expect(edit).not.toHaveBeenCalled();
    expect(refine).not.toHaveBeenCalled();
  });

  it('hands back a new shot id at reservation, with the budget and the footage under the playhead', async () => {
    generate.mockImplementation(async (req) => {
      req.onReserved?.('live-badge');
      return new Promise(() => {});
    });
    const res = await handleStudioShotGenerate(ev, {
      projectId: 'p1', op: 'generate', kind: 'overlay', brief: 'LIVE badge.', durationSeconds: 5, budget: 'quick', footage,
    });
    expect(res).toEqual({ success: true, shotId: 'live-badge' });
    expect(generate.mock.calls[0][0]).toMatchObject({ kind: 'overlay', budget: 'quick', footage, origin: { by: 'user' } });
    expect(generate.mock.calls[0][1]).toBeUndefined();
  });

  it('regenerates into the existing shot and fails fast before the folder exists', async () => {
    generate.mockRejectedValueOnce(new Error('Asset talk has no word-level transcript'));
    const res = await handleStudioShotGenerate(ev, { projectId: 'p1', op: 'regenerate', shotId: 's1', kind: 'title', brief: 'Words.' });
    expect(res).toEqual({ success: false, error: 'Asset talk has no word-level transcript' });
    expect(generate.mock.calls[0][1]).toBe('s1');
  });
});
