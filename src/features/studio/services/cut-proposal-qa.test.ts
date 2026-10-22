import { describe, it, expect } from 'vitest';
import type { CutQaItem, CutQaReport } from '@shared/types/studio-cut-plan';
import type { StudioProposal, StudioTimeline } from '@shared/types/studio';
import { buildQaSpots, mapQaItemToTimeline } from './cut-proposal';
import { applyCutProposal } from './apply-cut-proposal';

// One 10 s clip of a1 on V1; the proposal removes [2,3] (an Auto Cut gap) and
// [6,8] (an editorial span). Result: [0,2]@0 · [3,6]@2 · [8,10]@5.
const original: StudioTimeline = {
  tracks: [
    {
      id: 'v1',
      kind: 'video',
      name: 'V1',
      clips: [{ id: 'c1', kind: 'video', assetId: 'a1', timelineStart: 0, duration: 10, sourceIn: 0 }],
    },
  ],
};

function proposal(secondStatus: 'accepted' | 'rejected' = 'accepted'): StudioProposal {
  return {
    id: 'p',
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: '',
    items: [
      { id: 'x', status: 'accepted', assetId: 'a1', sourceStart: 2, sourceEnd: 3 },
      { id: 'y', status: secondStatus, assetId: 'a1', sourceStart: 6, sourceEnd: 8 },
    ],
  };
}

function spot(sourceTime: number, over: Partial<CutQaItem> = {}): CutQaItem {
  return { kind: 'clipped-tail', sourceTime, overDb: 7, assetId: 'a1', ...over };
}

describe('mapQaItemToTimeline', () => {
  const p = proposal();
  const result = applyCutProposal(original, p);

  it('plays on the result timeline the apply builds (fixture sanity)', () => {
    const pieces = result.tracks[0].clips.map((c) => [c.sourceIn, c.timelineStart, c.duration]);
    expect(pieces).toEqual([
      [0, 0, 2],
      [3, 2, 3],
      [8, 5, 2],
    ]);
  });

  it('a hard entry (the cut-in = the cut end) maps to the join', () => {
    expect(mapQaItemToTimeline(result, p, spot(3, { kind: 'hard-entry', overDb: 16 }))).toBe(2);
  });

  it('an Auto Cut tail landing on the cut start maps to the same join', () => {
    expect(mapQaItemToTimeline(result, p, spot(2))).toBe(2);
  });

  it('a spot inside kept audio maps through the piece it plays in', () => {
    expect(mapQaItemToTimeline(result, p, spot(4.5))).toBeCloseTo(3.5, 9);
  });

  it('a tail landing inside a removed span maps to that cut’s join (the kept edge)', () => {
    expect(mapQaItemToTimeline(result, p, spot(6.3))).toBe(5);
  });

  it('a rejected cut keeps its audio, so the same spot plays where it is', () => {
    const kept = proposal('rejected');
    const res = applyCutProposal(original, kept);
    expect(mapQaItemToTimeline(res, kept, spot(6.3))).toBeCloseTo(5.3, 9);
  });

  it('no asset, another asset, or a time no clip plays → null', () => {
    expect(mapQaItemToTimeline(result, p, { kind: 'hard-entry', sourceTime: 3, overDb: 16 })).toBe(
      null,
    );
    expect(mapQaItemToTimeline(result, p, spot(3, { assetId: 'other' }))).toBe(null);
    expect(mapQaItemToTimeline(result, p, spot(12))).toBe(null);
  });

  it('looks on the master lane first', () => {
    const twoLanes: StudioTimeline = {
      tracks: [
        {
          id: 'v2',
          kind: 'video',
          name: 'V2',
          clips: [{ id: 'o', kind: 'video', assetId: 'a1', timelineStart: 20, duration: 10, sourceIn: 0 }],
        },
        {
          id: 'v1',
          kind: 'video',
          name: 'V1',
          clips: [{ id: 'm', kind: 'video', assetId: 'a1', timelineStart: 40, duration: 10, sourceIn: 0 }],
        },
      ],
    };
    // masterLane = the last video track with clips.
    expect(mapQaItemToTimeline(twoLanes, { ...p, items: [] }, spot(1))).toBe(41);
  });
});

describe('buildQaSpots', () => {
  it('lists hard entries first (plan order), then tails loudest first, each mapped', () => {
    const p = proposal();
    const qa: CutQaReport = {
      hardEntries: 2,
      clippedTails: 2,
      joinsChecked: 3,
      atomsChecked: 3,
      items: [
        spot(3, { kind: 'hard-entry', overDb: 18 }),
        spot(8, { kind: 'hard-entry', overDb: 16.2 }),
        spot(2, { overDb: 7.1 }),
        spot(6.3, { overDb: 9.4 }),
      ],
    };
    const spots = buildQaSpots(applyCutProposal(original, p), p, qa);
    expect(spots.map((s) => [s.item.kind, s.item.overDb, s.time])).toEqual([
      ['hard-entry', 18, 2],
      ['hard-entry', 16.2, 5],
      ['clipped-tail', 9.4, 5],
      ['clipped-tail', 7.1, 2],
    ]);
  });
});
