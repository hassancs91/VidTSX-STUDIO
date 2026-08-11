import { describe, it, expect } from 'vitest';
import type { StudioProposal, StudioTimeline } from '@shared/types/studio';
import { applyCutProposal } from './apply-cut-proposal';
import { buildPreviewTimeMap } from './preview-mapping';

/** 20 s clip, cuts at source 5–8 and 12–14.5 → result pieces 0–5, 5–9, 9–14.5. */
function makeFixture() {
  const original: StudioTimeline = {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'a', timelineStart: 0, duration: 20, sourceIn: 0 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [{ id: 'm1', kind: 'audio', assetId: 'music', timelineStart: 0, duration: 30 }],
      },
    ],
  };
  const proposal: StudioProposal = {
    id: 'p',
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: '',
    items: [
      { id: 'x', status: 'accepted', assetId: 'a', sourceStart: 5, sourceEnd: 8 },
      { id: 'y', status: 'accepted', assetId: 'a', sourceStart: 12, sourceEnd: 14.5 },
    ],
  };
  const result = applyCutProposal(original, proposal);
  return { original, result, map: buildPreviewTimeMap(original, result)! };
}

describe('buildPreviewTimeMap', () => {
  it('maps inside kept pieces linearly (result → original)', () => {
    const { map } = makeFixture();
    expect(map.toOriginal(2)).toBe(2); // first piece unchanged
    expect(map.toOriginal(6)).toBe(9); // second piece: result 5..9 = original 8..12
    expect(map.toOriginal(10)).toBe(15.5); // third piece: result 9..14.5 = original 14.5..20
  });

  it('jumps the playhead across a cut at the join', () => {
    const { map } = makeFixture();
    // Just before/after the first join: original position leaps 5 → 8.
    expect(map.toOriginal(4.999)).toBeCloseTo(4.999);
    expect(map.toOriginal(5.001)).toBeCloseTo(8.001);
  });

  it('maps original → result, collapsing cut spans onto the join', () => {
    const { map } = makeFixture();
    expect(map.toResult(2)).toBe(2);
    expect(map.toResult(9)).toBe(6);
    expect(map.toResult(6.5)).toBe(5); // inside cut 5..8 → the join
    expect(map.toResult(13)).toBe(9); // inside cut 12..14.5 → second join
    expect(map.toResult(20)).toBe(14.5); // end maps to result end
  });

  it('round-trips positions that exist on both sides', () => {
    const { map } = makeFixture();
    for (const t of [0, 3, 5.5, 8, 11, 14]) {
      expect(map.toResult(map.toOriginal(t))).toBeCloseTo(t);
    }
  });

  it('returns null when the result equals the original', () => {
    const { original } = makeFixture();
    expect(buildPreviewTimeMap(original, original)).toBeNull();
  });
});
