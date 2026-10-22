import { describe, expect, it, vi } from 'vitest';
import type { ResolvedCutStyle } from '@shared/types/studio-cut-plan';
import { TEST_TIGHT_STYLE } from '@shared/studio/cut-style-test-fixtures';
import { ASSET, makeEnvelope, makeTimeline, wordSource } from '../services/text-edit-fixtures';

// AssemblyAI on video-14-raw: 0373 "a · uh · desk" — the "uh" sits inside the
// pads of its neighbours, so "Remove fillers" can cut the "um" but not it.
const WORDS = [
  { text: 'Hello', start: 0.5, end: 0.9 },
  { text: 'um', start: 1.2, end: 1.5 },
  { text: 'today', start: 1.9, end: 2.3 },
  { text: 'a', start: 3.0, end: 3.126 },
  { text: 'uh', start: 3.126, end: 3.166 },
  { text: 'desk', start: 3.193, end: 3.514 },
  { text: 'cleaner.', start: 3.514, end: 4.0 },
];

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...(await import('./hook-test-runtime')).fakeReact,
}));
vi.mock('./useAssetEnvelopes', async () => {
  const fixtures = await import('../services/text-edit-fixtures');
  return { useAssetEnvelopes: () => new Map([['a1', fixtures.makeEnvelope(WORDS)]]) };
});

import { renderHookOnce } from './hook-test-runtime';
import { useTextEdit } from './useTextEdit';

describe('useTextEdit — the delete toast counts what was really removed (B5 Problem 7 wiring)', () => {
  it('"Remove fillers" with one filler too tight to cut toasts 1, not 2', () => {
    expect(makeEnvelope(WORDS)).toBeTruthy();
    const showToast = vi.fn();
    const dispatch = vi.fn();
    const timeline = makeTimeline();
    const resolved = { style: TEST_TIGHT_STYLE } as unknown as ResolvedCutStyle;
    const { result } = renderHookOnce(() =>
      useTextEdit({
        projectId: 'p1',
        active: true,
        timeline,
        playerTimeline: timeline,
        words: wordSource(WORDS),
        assets: [ASSET],
        dispatch,
        rippleAllTracks: false,
        reviewOpen: false,
        cutStyle: { resolved, error: null },
        seek: () => {},
        showToast,
      }),
    );
    expect(result.fillersIn(null).map((t) => t.text)).toEqual(['um', 'uh']);
    expect(result.deleteFillers(null)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledTimes(1);
    const [message, type] = showToast.mock.calls[0] as [string, string];
    expect(message).toMatch(/^Removed 1 filler · −\d+\.\d s \(1 spot too tight to cut cleanly\)$/);
    expect(type).toBe('info');
  });
});
