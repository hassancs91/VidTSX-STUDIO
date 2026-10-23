// The Auto Cut IPC (B2): the button sends no style, only the LIVE document's
// preset/override settings, so the plan is cut with the project's resolved
// style; an explicit style (a caller naming one) still wins.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import type { ResolvedCutStyle } from '../../shared/types/studio-cut-plan';
import { TEST_TIGHT_STYLE } from '../../shared/studio/cut-style-test-fixtures';

const { resolveProjectCutStyle, runCutPlan } = vi.hoisted(() => ({
  resolveProjectCutStyle: vi.fn(),
  runCutPlan: vi.fn(),
}));

vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => '' }, dialog: {}, shell: {} }));
vi.mock('../services/studio/cut-style-store', () => ({ resolveProjectCutStyle }));
vi.mock('../services/studio/cut-plan-runner', () => ({ runCutPlan }));

import { handleStudioCutPlanRun } from './studio-handlers';

const event = {} as IpcMainInvokeEvent;
const RESOLVED: ResolvedCutStyle = {
  styleName: 'natural',
  style: TEST_TIGHT_STYLE,
  source: 'project',
  overrides: [],
  displayName: 'natural · project override',
  key: '0123abcd',
};
const REQ = { projectId: 'proj', assetId: 'a1', sourcePath: 'C:/clip.mp4' };

describe('handleStudioCutPlanRun', () => {
  beforeEach(() => {
    resolveProjectCutStyle.mockReset().mockResolvedValue(RESOLVED);
    runCutPlan.mockReset().mockResolvedValue({ plan: { segments: [] }, planPath: 'C:/p.json' });
  });

  it('resolves with the live settings and cuts with what resolved', async () => {
    const settings = { presetId: 'p1', cutStyle: { base: 'natural' as const } };
    const res = await handleStudioCutPlanRun(event, { ...REQ, settings });
    expect(resolveProjectCutStyle).toHaveBeenCalledWith('proj', { settings });
    expect(runCutPlan).toHaveBeenCalledWith('proj', 'a1', 'C:/clip.mp4', RESOLVED, undefined);
    expect(res).toEqual({ success: true, plan: { segments: [] }, planPath: 'C:/p.json' });
  });

  it('without settings or a style, leaves the store to read project.json', async () => {
    await handleStudioCutPlanRun(event, REQ);
    expect(resolveProjectCutStyle).toHaveBeenCalledWith('proj', {});
  });

  it('passes an explicit style through as the call style', async () => {
    await handleStudioCutPlanRun(event, { ...REQ, style: 'relaxed' });
    expect(resolveProjectCutStyle).toHaveBeenCalledWith('proj', { callStyle: 'relaxed' });
  });

  it('forwards the timeline keeps to the runner (B7)', async () => {
    const keeps = [{ start: 0, end: 4 }, { start: 9, end: 20 }];
    await handleStudioCutPlanRun(event, { ...REQ, keeps });
    expect(runCutPlan).toHaveBeenCalledWith('proj', 'a1', 'C:/clip.mp4', RESOLVED, keeps);
  });

  it('returns a typed error instead of throwing', async () => {
    resolveProjectCutStyle.mockRejectedValue(new Error('cut-style.json: not valid JSON (x)'));
    const res = await handleStudioCutPlanRun(event, REQ);
    expect(res).toEqual({ success: false, error: 'cut-style.json: not valid JSON (x)' });
    expect(runCutPlan).not.toHaveBeenCalled();
  });
});
