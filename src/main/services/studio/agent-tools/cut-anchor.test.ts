// The cut anchor (ASSISTANT_TIMELINE_DESIGN §5, §8.1 4): `{ cut, offset? }`
// resolved on the saved timeline — anchored to the footage when the shared
// source→timeline mapping lands exactly on the point, else a fixed time; the
// exact errors; and the anchored item following a later trim.
import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioTimeline } from '../../../../shared/types/studio';
import { mapSourceSpanToTimeline } from '../../../../shared/studio/source-span-map';
import { buildInsertProposal } from '../timeline-insert';
import { cutAnchorLabel, resolveCutAnchor } from './cut-anchor';

const E3V = 'ed2cde25-2bfe-4005-a544-adced7e5299c';

function video(id: string, start: number, duration: number, sourceIn: number, extra: Partial<StudioClip> = {}): StudioClip {
  return { id, kind: 'video', assetId: E3V, timelineStart: start, duration, sourceIn, ...extra };
}

function timelineOf(master: StudioClip[]): StudioTimeline {
  return {
    tracks: [
      { id: 'v1', kind: 'video', name: 'V1', clips: master },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  };
}

/** The 2-clip test project: V1 = e3v-c1 0–3 s src 0–3, e3v-c2 3–6 s src 4–7; A1 empty. */
const twoClip = (): StudioTimeline => timelineOf([video('e3v-c1', 0, 3, 0), video('e3v-c2', 3, 3, 4)]);

describe('resolveCutAnchor — anchored to the footage', () => {
  it('{ cut: 1 } → the clip after the cut, source 4, t = 3.00', () => {
    expect(resolveCutAnchor(twoClip(), { cut: 1 }, 0.7)).toEqual({
      ok: true,
      t: 3,
      at: { anchorAssetId: E3V, sourceStart: 4 },
      atLabel: 'at cut 1 (0:03.00 on the timeline)',
    });
  });

  it('offset −0.25 → the clip before the cut, source 2.75, t = 2.75', () => {
    expect(resolveCutAnchor(twoClip(), { cut: 1, offset: -0.25 }, 0.7)).toEqual({
      ok: true,
      t: 2.75,
      at: { anchorAssetId: E3V, sourceStart: 2.75 },
      atLabel: '0.25 s before cut 1 (0:02.75 on the timeline)',
    });
  });

  it('offset 0.5 → source 4.5, t = 3.50', () => {
    expect(resolveCutAnchor(twoClip(), { cut: 1, offset: 0.5 }, 0.7)).toEqual({
      ok: true,
      t: 3.5,
      at: { anchorAssetId: E3V, sourceStart: 4.5 },
      atLabel: '0.50 s after cut 1 (0:03.50 on the timeline)',
    });
  });

  it('an offset of exactly the left clip\'s length lands on its first frame', () => {
    const r = resolveCutAnchor(twoClip(), { cut: 1, offset: -3 }, 0.7);
    expect(r).toEqual({ ok: true, t: 0, at: { anchorAssetId: E3V, sourceStart: 0 }, atLabel: '3.00 s before cut 1 (0:00.00 on the timeline)' });
  });

  it('cut numbers count over the whole timeline (a through edit and a gap are not cuts)', () => {
    const tl = timelineOf([
      video('a', 0, 2, 0),
      video('b', 2, 2, 2), // a through edit at 2 (source runs on)
      video('c', 4.5, 1, 10), // a gap 4–4.5
      video('d', 5.5, 1, 20), // cut 1 at 5.5
    ]);
    expect(resolveCutAnchor(tl, { cut: 1 }, 0.5)).toMatchObject({ ok: true, t: 5.5, at: { anchorAssetId: E3V, sourceStart: 20 } });
  });
});

describe('resolveCutAnchor — the fixed { timelineStart: t } fallback', () => {
  it('a TSX clip after the cut', () => {
    const tl = timelineOf([
      video('e3v-c1', 0, 3, 0),
      { id: 's1', kind: 'tsx', timelineStart: 3, duration: 3, tsx: { shotId: 'shot-1', mode: 'cutaway' } },
    ]);
    expect(resolveCutAnchor(tl, { cut: 1 }, 0.7)).toEqual({
      ok: true,
      t: 3,
      at: { timelineStart: 3 },
      atLabel: 'at cut 1 (0:03.00 on the timeline)',
    });
  });

  it('an image clip before the cut', () => {
    const tl = timelineOf([
      { id: 'i1', kind: 'image', assetId: 'img-1', timelineStart: 0, duration: 3 },
      video('e3v-c2', 3, 3, 4),
    ]);
    expect(resolveCutAnchor(tl, { cut: 1, offset: -0.5 }, 0.7)).toMatchObject({ ok: true, t: 2.5, at: { timelineStart: 2.5 } });
  });

  it('a speed-2 clip after the cut with offset ≠ 0 (the renderer mapping ignores speed)', () => {
    const tl = timelineOf([video('e3v-c1', 0, 3, 0), video('e3v-c2', 3, 3, 4, { speed: 2 })]);
    expect(resolveCutAnchor(tl, { cut: 1, offset: 0.5 }, 0.7)).toEqual({
      ok: true,
      t: 3.5,
      at: { timelineStart: 3.5 },
      atLabel: '0.50 s after cut 1 (0:03.50 on the timeline)',
    });
  });

  it('the same source played earlier (the mapping would land on the earlier clip)', () => {
    const tl = timelineOf([video('first', 0, 3, 4), video('again', 3, 3, 4)]);
    expect(resolveCutAnchor(tl, { cut: 1 }, 0.7)).toMatchObject({ ok: true, t: 3, at: { timelineStart: 3 } });
  });
});

describe('resolveCutAnchor — errors (exact)', () => {
  it('cut 2 on the 2-clip project names "1 cut"', () => {
    expect(resolveCutAnchor(twoClip(), { cut: 2 }, 0.7)).toEqual({
      ok: false,
      error: 'The master track "V1" has 1 cut — cut 2 does not exist (cuts count from 1 in timeline order; get_timeline lists them).',
    });
  });

  it('plural cuts', () => {
    const tl = timelineOf([video('a', 0, 1, 0), video('b', 1, 1, 5), video('c', 2, 1, 9)]);
    expect(resolveCutAnchor(tl, { cut: 3 }, 0.5)).toEqual({
      ok: false,
      error: 'The master track "V1" has 2 cuts — cut 3 does not exist (cuts count from 1 in timeline order; get_timeline lists them).',
    });
  });

  it('a 1-clip timeline and an empty one → "(0 cuts)"', () => {
    expect(resolveCutAnchor(timelineOf([video('only', 0, 6, 0)]), { cut: 1 }, 0.7)).toEqual({
      ok: false,
      error: 'There is no cut on the master track "V1" (0 cuts) — pass `at` as timeline seconds or { word, take }.',
    });
    expect(resolveCutAnchor(timelineOf([]), { cut: 1 }, 0.7)).toEqual({
      ok: false,
      error: 'There is no cut on the master track (0 cuts) — pass `at` as timeline seconds or { word, take }.',
    });
  });

  it('an offset past its clip, after and before', () => {
    expect(resolveCutAnchor(twoClip(), { cut: 1, offset: 3 }, 0.7)).toEqual({
      ok: false,
      error: '3.00 s after cut 1 is outside the clip after it (3.00 s long) — pass `at` as timeline seconds instead.',
    });
    expect(resolveCutAnchor(twoClip(), { cut: 1, offset: -3.5 }, 0.7)).toEqual({
      ok: false,
      error: '3.50 s before cut 1 is outside the clip before it (3.00 s long) — pass `at` as timeline seconds instead.',
    });
  });
});

describe('cutAnchorLabel', () => {
  it('at / before / after, with the timeline time', () => {
    expect(cutAnchorLabel(2, 0, 12.5)).toBe('at cut 2 (0:12.50 on the timeline)');
    expect(cutAnchorLabel(1, -0.25, 2.75)).toBe('0.25 s before cut 1 (0:02.75 on the timeline)');
    expect(cutAnchorLabel(3, 1.234, 61.234)).toBe('1.23 s after cut 3 (1:01.23 on the timeline)');
  });
});

describe('the anchored item survives a trim', () => {
  it('shorten e3v-c1 to 2 s and move e3v-c2 to 2.0 → the item maps to 2.00 (the new join)', () => {
    const resolved = resolveCutAnchor(twoClip(), { cut: 1 }, 0.7);
    if (!resolved.ok) throw new Error(resolved.error);
    const proposal = buildInsertProposal({
      asset: { id: 'whoosh-soft', name: 'whoosh-soft.mp3', kind: 'audio', durationSeconds: 0.7 },
      lane: 'audio',
      at: resolved.at,
      atLabel: resolved.atLabel,
    });
    const item = proposal.items[0];
    expect(item).toMatchObject({ assetId: E3V, sourceStart: 4, sourceEnd: 4.7, duration: 0.7 });
    const trimmed = timelineOf([video('e3v-c1', 0, 2, 0), video('e3v-c2', 2, 3, 4)]);
    const span = { assetId: E3V, sourceStart: item.sourceStart ?? NaN, sourceEnd: item.sourceEnd ?? NaN };
    expect(mapSourceSpanToTimeline(twoClip(), span)[0].start).toBe(3);
    expect(mapSourceSpanToTimeline(trimmed, span)[0].start).toBe(2);
  });
});
