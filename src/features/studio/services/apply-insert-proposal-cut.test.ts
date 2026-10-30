// The cut anchor's item, renderer side (ASSISTANT_TIMELINE_DESIGN §8.1 4): an
// insert item anchored at cut 1 of the 2-clip project — written by hand, the
// shape insert_asset({ cut: 1 }) emits; no src/main import — lands at the
// join, and follows it when the edit is trimmed before apply.
import { describe, it, expect } from 'vitest';
import type { StudioProposalItem, StudioTimeline } from '../types';
import { applyInsertProposal, insertItemPlacement } from './apply-insert-proposal';

const E3V = 'ed2cde25-2bfe-4005-a544-adced7e5299c';

function timeline(c1Duration: number, c2Start: number): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'e3v-c1', kind: 'video', assetId: E3V, timelineStart: 0, duration: c1Duration, sourceIn: 0 },
          { id: 'e3v-c2', kind: 'video', assetId: E3V, timelineStart: c2Start, duration: 3, sourceIn: 4 },
        ],
      },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  };
}

const item: StudioProposalItem = {
  id: 'ins_cut1',
  status: 'accepted',
  assetId: E3V,
  sourceStart: 4,
  sourceEnd: 4.7,
  duration: 0.7,
  insert: { assetId: 'whoosh-soft', kind: 'audio', lane: 'audio' },
};

describe('an item anchored at cut 1 (renderer placement)', () => {
  it('lands at 3.00 on the 2-clip project', () => {
    expect(insertItemPlacement(timeline(3, 3), item)).toBe(3);
  });

  it('after e3v-c1 is shortened to 2 s and e3v-c2 moved to 2.0, it lands at 2.00 (the new join)', () => {
    const trimmed = timeline(2, 2);
    expect(insertItemPlacement(trimmed, item)).toBe(2);
    const applied = applyInsertProposal(trimmed, {
      id: 'prop-1',
      kind: 'insert-plan',
      status: 'proposed',
      createdAt: '2026-10-30T00:00:00.000Z',
      agentNote: 'Insert "whoosh-soft.mp3" as audio at cut 1 (0:03.00 on the timeline) · 0.7 s',
      items: [item],
    });
    const a1 = applied.tracks.find((t) => t.id === 'a1');
    expect(a1?.clips.map((c) => [c.assetId, c.timelineStart, c.duration])).toEqual([['whoosh-soft', 2, 0.7]]);
  });
});
