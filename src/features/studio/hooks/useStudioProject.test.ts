import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioProject } from '../types';
import { STUDIO_SCHEMA_VERSION } from '@shared/types/studio';

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...(await import('./hook-test-runtime')).fakeReact,
}));
vi.mock('../services/open-timing', () => ({ markOpen: () => {}, resetOpenMarks: () => {} }));

import { renderHookOnce } from './hook-test-runtime';
import { useStudioProject } from './useStudioProject';

function makeProject(name: string): StudioProject {
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    id: 'p1',
    name,
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    settings: { width: 1920, height: 1080, fps: 60, agent: {} },
    assets: [],
    timeline: { tracks: [] },
    proposals: [],
    shots: [],
  };
}

interface LoadReply {
  success: boolean;
  project?: StudioProject;
  folderPath?: string;
  recovered?: boolean;
  unsaved?: boolean;
}

function installApi(load: LoadReply, saveOk = false) {
  let flushListener: (() => void) | null = null;
  const calls: string[] = [];
  const api = {
    studioProjectLoad: vi.fn(async () => load),
    // project.json is held by another program: every save is refused.
    studioProjectSave: vi.fn(async () => {
      calls.push('save');
      return saveOk ? { success: true } : { success: false, error: 'EPERM: operation not permitted, rename' };
    }),
    studioProjectHandoff: vi.fn(async (_req: { project: StudioProject }) => {
      calls.push('handoff');
      return { success: true };
    }),
    studioProjectClose: vi.fn(async () => {
      calls.push('close');
      return { success: true };
    }),
    studioFlushAck: vi.fn(async () => {
      calls.push('ack');
      return { success: true };
    }),
    onStudioFlushRequest: vi.fn((cb: () => void) => {
      flushListener = cb;
      return () => {
        flushListener = null;
      };
    }),
  };
  vi.stubGlobal('window', {
    api,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  return { api, calls, requestFlush: () => flushListener?.() };
}

describe('useStudioProject — the save wiring (B5 fix round 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('closing the editor with an unsaved edit hands the document to main, then closes', async () => {
    const { api, calls } = installApi({ success: true, project: makeProject('original'), folderPath: 'X' });
    const view = renderHookOnce(() => useStudioProject('p1'));
    await vi.advanceTimersByTimeAsync(0);
    view.result.updateProject((prev) => ({ ...prev, name: 'edited' }));
    await vi.advanceTimersByTimeAsync(700); // the debounced save is refused
    expect(api.studioProjectSave).toHaveBeenCalled();

    view.unmount();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.studioProjectHandoff).toHaveBeenCalledTimes(1);
    expect(api.studioProjectHandoff.mock.calls[0][0].project.name).toBe('edited');
    expect(calls.slice(-2)).toEqual(['handoff', 'close']);
    // Nothing keeps retrying from the closed editor.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls.slice(-2)).toEqual(['handoff', 'close']);
  });

  it('closing with nothing unsaved hands nothing off', async () => {
    const { api } = installApi({ success: true, project: makeProject('original'), folderPath: 'X' }, true);
    const view = renderHookOnce(() => useStudioProject('p1'));
    await vi.advanceTimersByTimeAsync(0);
    view.result.updateProject((prev) => ({ ...prev, name: 'edited' }));
    await vi.advanceTimersByTimeAsync(700);
    view.unmount();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.studioProjectHandoff).not.toHaveBeenCalled();
    expect(api.studioProjectClose).toHaveBeenCalledTimes(1);
  });

  it('the quit flush request hands an unsaved edit to main BEFORE acking', async () => {
    const { api, calls, requestFlush } = installApi({
      success: true,
      project: makeProject('original'),
      folderPath: 'X',
    });
    const view = renderHookOnce(() => useStudioProject('p1'));
    await vi.advanceTimersByTimeAsync(0);
    view.result.updateProject((prev) => ({ ...prev, name: 'edited' }));
    await vi.advanceTimersByTimeAsync(100); // quit lands inside the debounce
    requestFlush();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.studioProjectHandoff).toHaveBeenCalledTimes(1);
    expect(api.studioProjectHandoff.mock.calls[0][0].project.name).toBe('edited');
    expect(calls).toEqual(['handoff', 'ack']);
  });

  it('a recovered document is flagged once and saved (it is not on disk yet)', async () => {
    const { api } = installApi(
      { success: true, project: makeProject('recovered'), folderPath: 'X', recovered: true, unsaved: true },
      true,
    );
    const view = renderHookOnce(() => useStudioProject('p1'));
    await vi.advanceTimersByTimeAsync(0);
    expect(view.rerender().recovered).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(api.studioProjectSave).toHaveBeenCalledTimes(1);
  });

  it('a normal open is not flagged and saves nothing', async () => {
    const { api } = installApi({ success: true, project: makeProject('original'), folderPath: 'X' }, true);
    const view = renderHookOnce(() => useStudioProject('p1'));
    await vi.advanceTimersByTimeAsync(700);
    expect(view.rerender().recovered).toBe(false);
    expect(api.studioProjectSave).not.toHaveBeenCalled();
  });
});
