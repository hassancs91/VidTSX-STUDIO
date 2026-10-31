import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';
import type { ResolvedCutStyle } from '../../shared/types/studio-cut-plan';
import { TEST_TIGHT_STYLE } from '../../shared/studio/cut-style-test-fixtures';

const resolveProjectCutStyle = vi.hoisted(() => vi.fn());
const loadCutStyleFile = vi.hoisted(() => vi.fn());
vi.mock('../services/studio/cut-style-store', () => ({ resolveProjectCutStyle, loadCutStyleFile }));

import { handleStudioCutStyleFile, handleStudioCutStyleResolve } from './cut-style-handlers';

const event = {} as IpcMainInvokeEvent;
const RESOLVED: ResolvedCutStyle = {
  styleName: 'tight',
  style: TEST_TIGHT_STYLE,
  source: 'default',
  overrides: [],
  displayName: 'tight · default',
  key: '0123abcd',
};

describe('handleStudioCutStyleResolve', () => {
  beforeEach(() => {
    resolveProjectCutStyle.mockReset();
  });

  it('resolves with the live settings it is handed', async () => {
    resolveProjectCutStyle.mockResolvedValue(RESOLVED);
    const settings = { presetId: 'p1', cutStyle: { base: 'natural' as const } };
    const res = await handleStudioCutStyleResolve(event, { projectId: 'proj', settings });
    expect(res).toEqual({ success: true, resolved: RESOLVED });
    expect(resolveProjectCutStyle).toHaveBeenCalledWith('proj', { settings });
  });

  it('without settings, leaves the store to read project.json', async () => {
    resolveProjectCutStyle.mockResolvedValue(RESOLVED);
    await handleStudioCutStyleResolve(event, { projectId: 'proj' });
    expect(resolveProjectCutStyle).toHaveBeenCalledWith('proj', {});
  });

  it('returns a typed error instead of throwing', async () => {
    resolveProjectCutStyle.mockRejectedValue(new Error('cut-style.json: not valid JSON (x)'));
    const res = await handleStudioCutStyleResolve(event, { projectId: 'proj' });
    expect(res).toEqual({ success: false, error: 'cut-style.json: not valid JSON (x)' });
  });
});

describe('handleStudioCutStyleFile', () => {
  beforeEach(() => {
    loadCutStyleFile.mockReset();
  });

  it('hands over the parsed file', async () => {
    const file = { default: 'tight', styles: { tight: TEST_TIGHT_STYLE } };
    loadCutStyleFile.mockResolvedValue(file);
    expect(await handleStudioCutStyleFile()).toEqual({ success: true, file });
  });

  it('returns a typed error instead of throwing', async () => {
    loadCutStyleFile.mockRejectedValue(new Error('cut-style.json: style "relaxed" is missing'));
    expect(await handleStudioCutStyleFile()).toEqual({
      success: false,
      error: 'cut-style.json: style "relaxed" is missing',
    });
  });
});
