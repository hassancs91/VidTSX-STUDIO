import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import { clipsInRect, moveClips, removeClips } from './timeline-group-ops';

/** V1: three cuts with gaps; A1: music + a stinger. */
function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'a', timelineStart: 0, duration: 4, sourceIn: 0 },
          { id: 'c2', kind: 'video', assetId: 'a', timelineStart: 5, duration: 3, sourceIn: 10 },
          { id: 'c3', kind: 'video', assetId: 'a', timelineStart: 10, duration: 2, sourceIn: 20 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [
          { id: 'm1', kind: 'audio', assetId: 'm', timelineStart: 0, duration: 8 },
          { id: 'm2', kind: 'audio', assetId: 'm', timelineStart: 9, duration: 2 },
        ],
      },
    ],
  };
}

const v1 = (t: StudioTimeline) => t.tracks[0].clips.map((c) => [c.id, c.timelineStart]);
const a1 = (t: StudioTimeline) => t.tracks[1].clips.map((c) => [c.id, c.timelineStart]);

describe('moveClips', () => {
  it('moves the group as one, preserving relative gaps', () => {
    const next = moveClips(makeTimeline(), ['c2', 'c3'], 1.5);
    expect(v1(next)).toEqual([
      ['c1', 0],
      ['c2', 6.5],
      ['c3', 11.5],
    ]);
  });

  it('clamps the whole group when ONE member hits an unselected neighbour', () => {
    // c2 moving left collides with c1 (ends at 4) after 1 s — c3 stops too.
    const next = moveClips(makeTimeline(), ['c2', 'c3'], -3);
    expect(v1(next)).toEqual([
      ['c1', 0],
      ['c2', 4],
      ['c3', 9],
    ]);
  });

  it('moves clips on different tracks together, each clamped by its own track', () => {
    // m2 can go left only 1 s (m1 ends at 8); the whole group clamps to −1.
    const next = moveClips(makeTimeline(), ['c3', 'm2'], -2);
    expect(v1(next)[2]).toEqual(['c3', 9]);
    expect(a1(next)[1]).toEqual(['m2', 8]);
  });

  it('rejects when boxed in and when ids are unknown', () => {
    const timeline = makeTimeline();
    // c2 selected alone between c1 (ends 4) and c3 (starts 10): free room exists,
    // but selecting all three and pushing left past zero clamps to 0 shift for c1.
    expect(moveClips(timeline, ['c1', 'c2', 'c3'], -5)).toBe(timeline); // c1 already at 0
    expect(moveClips(timeline, ['ghost'], 2)).toBe(timeline);
    expect(moveClips(timeline, [], 2)).toBe(timeline);
  });

  it('rejects the move when any member sits on a locked track', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].locked = true;
    expect(moveClips(timeline, ['c3', 'm2'], 1)).toBe(timeline);
  });
});

describe('removeClips', () => {
  it('ripple-deletes a group: later clips close the full removed span', () => {
    const next = removeClips(makeTimeline(), ['c1', 'c2'], true);
    expect(v1(next)).toEqual([['c3', 3]]); // 10 − 4 − 3
    expect(a1(next)).toEqual(a1(makeTimeline())); // other track untouched
  });

  it('plain delete leaves positions alone', () => {
    const next = removeClips(makeTimeline(), ['c2'], false);
    expect(v1(next)).toEqual([
      ['c1', 0],
      ['c3', 10],
    ]);
  });

  it('ripples per track when the group spans tracks', () => {
    const next = removeClips(makeTimeline(), ['c1', 'm1'], true);
    expect(v1(next)).toEqual([
      ['c2', 1],
      ['c3', 6],
    ]);
    expect(a1(next)).toEqual([['m2', 1]]);
  });

  it('returns the identical object when nothing matches or the track is locked', () => {
    const timeline = makeTimeline();
    expect(removeClips(timeline, ['ghost'], true)).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(removeClips(locked, ['c1'], true)).toBe(locked);
  });
});

describe('clipsInRect', () => {
  it('selects clips intersecting the rectangle across rows', () => {
    // 20 px/s, 56 px rows: x 90–130 px = 4.5–6.5 s, rows 0–1.
    const ids = clipsInRect(makeTimeline(), 20, 56, { x1: 90, y1: 10, x2: 130, y2: 70 });
    expect(ids.sort()).toEqual(['c2', 'm1']);
  });

  it('handles inverted (right-to-left, bottom-to-top) drags', () => {
    const ids = clipsInRect(makeTimeline(), 20, 56, { x1: 130, y1: 70, x2: 90, y2: 10 });
    expect(ids.sort()).toEqual(['c2', 'm1']);
  });
});
