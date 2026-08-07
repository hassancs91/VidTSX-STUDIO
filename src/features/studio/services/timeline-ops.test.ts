import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import {
  addClip,
  clipAt,
  findClip,
  findFreeSlot,
  moveClip,
  removeClip,
  splitClip,
  trimClip,
} from './timeline-ops';

/** V1 holds two back-to-back cuts of the same source; A1 holds a music bed. */
function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 5, sourceIn: 0 },
          { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 20 },
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

describe('splitClip', () => {
  it('cuts in two and advances the right half into the source', () => {
    const next = splitClip(makeTimeline(), 'c1', 2, 'new');
    expect(v1(next).map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn])).toEqual([
      ['c1', 0, 2, 0],
      ['new', 2, 3, 2],
      ['c2', 5, 5, 20],
    ]);
  });

  it('carries the source offset of an already-trimmed clip', () => {
    const next = splitClip(makeTimeline(), 'c2', 7.5, 'new');
    const created = findClip(next, 'new');
    expect(created?.clip.sourceIn).toBe(22.5);
  });

  it('refuses a split at the very edge (no zero-length clips)', () => {
    const timeline = makeTimeline();
    expect(splitClip(timeline, 'c1', 0)).toBe(timeline);
    expect(splitClip(timeline, 'c1', 5)).toBe(timeline);
    expect(splitClip(timeline, 'missing', 2)).toBe(timeline);
  });
});

describe('trimClip', () => {
  it('trimming the start keeps the visible frame put by advancing sourceIn', () => {
    const next = trimClip(makeTimeline(), 'c2', 'start', 6);
    const clip = findClip(next, 'c2')!.clip;
    expect(clip.timelineStart).toBe(6);
    expect(clip.duration).toBe(4);
    expect(clip.sourceIn).toBe(21);
  });

  it('stops the start edge at the previous clip', () => {
    const next = trimClip(makeTimeline(), 'c2', 'start', 3);
    expect(findClip(next, 'c2')!.clip.timelineStart).toBe(5);
  });

  it('cannot pull a clip start before the first frame of its source', () => {
    // c1 starts at sourceIn 0, so there is nothing to reveal on its left.
    const next = trimClip(makeTimeline(), 'c1', 'start', -3);
    expect(findClip(next, 'c1')!.clip.timelineStart).toBe(0);
  });

  it('stops the end edge at the next clip', () => {
    const next = trimClip(makeTimeline(), 'c1', 'end', 8);
    expect(findClip(next, 'c1')!.clip.duration).toBe(5);
  });

  it('stops the end edge at the end of the source media', () => {
    // c2 plays from 20s into a 24s source: at most 4s of material remains.
    const next = trimClip(makeTimeline(), 'c2', 'end', 20, 24);
    expect(findClip(next, 'c2')!.clip.duration).toBe(4);
  });
});

describe('removeClip', () => {
  it('ripple-delete closes the gap on that track only', () => {
    const next = removeClip(makeTimeline(), 'c1', true);
    expect(v1(next).map((c) => [c.id, c.timelineStart])).toEqual([['c2', 0]]);
    // The music bed keeps its timing — that is the point of per-track ripple.
    expect(a1(next)[0].timelineStart).toBe(0);
  });

  it('plain delete leaves the gap', () => {
    const next = removeClip(makeTimeline(), 'c1', false);
    expect(v1(next).map((c) => [c.id, c.timelineStart])).toEqual([['c2', 5]]);
  });

  it('leaves a locked track untouched', () => {
    const timeline = makeTimeline();
    timeline.tracks[0].locked = true;
    expect(removeClip(timeline, 'c1', true)).toBe(timeline);
  });
});

describe('moveClip', () => {
  it('clamps against a neighbour instead of overlapping it', () => {
    const next = moveClip(makeTimeline(), 'c2', 2);
    expect(findClip(next, 'c2')!.clip.timelineStart).toBe(5);
  });

  it('moves freely into open space and never before zero', () => {
    const next = moveClip(makeTimeline(), 'c2', 20);
    expect(findClip(next, 'c2')!.clip.timelineStart).toBe(20);
    expect(findClip(moveClip(makeTimeline(), 'c1', -5), 'c1')!.clip.timelineStart).toBe(0);
  });

  it('moves a clip to another track', () => {
    const next = moveClip(makeTimeline(), 'c2', 40, 'a1');
    expect(v1(next).map((c) => c.id)).toEqual(['c1']);
    expect(a1(next).map((c) => c.id)).toEqual(['m1', 'c2']);
  });

  it('keeps clips sorted by start time', () => {
    const next = moveClip(makeTimeline(), 'c2', 30);
    const moved = moveClip(next, 'c1', 40);
    expect(v1(moved).map((c) => [c.id, c.timelineStart])).toEqual([
      ['c2', 30],
      ['c1', 40],
    ]);
  });
});

describe('placement helpers', () => {
  it('findFreeSlot skips past occupied ranges', () => {
    const track = makeTimeline().tracks[0];
    expect(findFreeSlot(track, 3, 0)).toBe(10);
    expect(findFreeSlot(track, 3, 12)).toBe(12);
  });

  it('addClip drops a new clip after existing material', () => {
    const next = addClip(makeTimeline(), 'v1', {
      id: 'new',
      kind: 'video',
      assetId: 'asset2',
      timelineStart: 0,
      duration: 4,
      sourceIn: 0,
    });
    expect(findClip(next, 'new')!.clip.timelineStart).toBe(10);
  });

  it('clipAt finds the clip under a time, exclusive of its end', () => {
    const track = makeTimeline().tracks[0];
    expect(clipAt(track, 4.99)?.id).toBe('c1');
    expect(clipAt(track, 5)?.id).toBe('c2');
    expect(clipAt(track, 10)).toBeNull();
  });
});
