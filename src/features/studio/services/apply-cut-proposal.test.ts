import { describe, it, expect } from 'vitest';
import type { StudioProposal, StudioProposalItem, StudioTimeline } from '@shared/types/studio';
import { applyCutProposal } from './apply-cut-proposal';

function makeProposal(items: Array<Partial<StudioProposalItem>>): StudioProposal {
  return {
    id: 'prop1',
    kind: 'cut-plan',
    status: 'proposed',
    createdAt: '',
    items: items.map((item, i) => ({
      id: `cut_${i}`,
      status: 'accepted',
      assetId: 'asset1',
      ...item,
    })),
  };
}

/** One 20 s talking-head clip on V1, music on A1. */
function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          {
            id: 'c1',
            kind: 'video',
            assetId: 'asset1',
            timelineStart: 0,
            duration: 20,
            sourceIn: 0,
          },
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
}

const v1 = (t: StudioTimeline) => t.tracks[0].clips;
const a1 = (t: StudioTimeline) => t.tracks[1].clips;

describe('applyCutProposal', () => {
  it('cuts accepted spans, keeps survivors contiguous, leaves other tracks alone', () => {
    const next = applyCutProposal(
      makeTimeline(),
      makeProposal([
        { sourceStart: 5, sourceEnd: 8 },
        { sourceStart: 12, sourceEnd: 14.5 },
      ]),
    );
    expect(v1(next).map((c) => [c.timelineStart, c.duration, c.sourceIn])).toEqual([
      [0, 5, 0],
      [5, 4, 8],
      [9, 5.5, 14.5],
    ]);
    // Music holds its timing — ripple is per-track.
    expect(a1(next)).toEqual(makeTimeline().tracks[1].clips);
  });

  it('skips rejected items', () => {
    const next = applyCutProposal(
      makeTimeline(),
      makeProposal([
        { sourceStart: 5, sourceEnd: 8 },
        { sourceStart: 12, sourceEnd: 14.5, status: 'rejected' },
      ]),
    );
    expect(v1(next).map((c) => [c.timelineStart, c.duration, c.sourceIn])).toEqual([
      [0, 5, 0],
      [5, 12, 8], // 8..20 survives in one piece
    ]);
  });

  it('tags reshaped clips with agent provenance; first piece keeps its id', () => {
    const next = applyCutProposal(makeTimeline(), makeProposal([{ sourceStart: 5, sourceEnd: 8 }]));
    const clips = v1(next);
    expect(clips[0].id).toBe('c1');
    expect(clips[1].id).not.toBe('c1');
    for (const clip of clips) {
      expect(clip.origin).toEqual({ by: 'agent', proposalId: 'prop1' });
    }
  });

  it('handles a cut that spans a clip boundary and ripples the rest', () => {
    const timeline = makeTimeline();
    timeline.tracks[0].clips = [
      { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 5, sourceIn: 0 },
      { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 10 },
    ];
    // Cut source 4..11: trims the end of c1 and the head of c2.
    const next = applyCutProposal(timeline, makeProposal([{ sourceStart: 4, sourceEnd: 11 }]));
    expect(v1(next).map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn])).toEqual([
      ['c1', 0, 4, 0],
      ['c2', 4, 4, 11],
    ]);
  });

  it('drops kept slivers shorter than a frame instead of emitting them', () => {
    const next = applyCutProposal(
      makeTimeline(),
      makeProposal([
        { sourceStart: 0.01, sourceEnd: 8 }, // leaves a 0.01 s sliver at the head
      ]),
    );
    expect(v1(next).map((c) => [c.timelineStart, c.duration, c.sourceIn])).toEqual([
      [0, 12, 8],
    ]);
  });

  it('merges overlapping spans from user-adjusted edges', () => {
    const next = applyCutProposal(
      makeTimeline(),
      makeProposal([
        { sourceStart: 5, sourceEnd: 8 },
        { sourceStart: 7, sourceEnd: 9 },
      ]),
    );
    expect(v1(next).map((c) => [c.timelineStart, c.duration, c.sourceIn])).toEqual([
      [0, 5, 0],
      [5, 11, 9],
    ]);
  });

  it('returns the identical object when nothing applies', () => {
    const timeline = makeTimeline();
    expect(applyCutProposal(timeline, makeProposal([]))).toBe(timeline);
    expect(
      applyCutProposal(
        timeline,
        makeProposal([{ sourceStart: 5, sourceEnd: 8, status: 'rejected' }]),
      ),
    ).toBe(timeline);
    expect(
      applyCutProposal(timeline, makeProposal([{ sourceStart: 5, sourceEnd: 8, assetId: 'ghost' }])),
    ).toBe(timeline);
  });

  it('leaves locked tracks untouched', () => {
    const timeline = makeTimeline();
    timeline.tracks[0].locked = true;
    expect(applyCutProposal(timeline, makeProposal([{ sourceStart: 5, sourceEnd: 8 }]))).toBe(
      timeline,
    );
  });
});
