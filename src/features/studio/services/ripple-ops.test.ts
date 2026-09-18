import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import {
  cutSpanFromClips,
  insertGapAllTracks,
  removeClipsRippleAll,
  removeSpanAllTracks,
  removeSpanFromTrack,
  trimClipRippleAll,
} from './ripple-ops';

/**
 * Tracks top to bottom (index 0 is painted in front): S1 holds two TSX shots
 * placed against the master, V1 is the master lane with two cuts of one
 * source, A1 is a music bed. Everything in whole seconds so the expectations
 * read at a glance.
 */
function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 's1',
        kind: 'overlay',
        name: 'Shots',
        clips: [
          { id: 'sh1', kind: 'tsx', timelineStart: 2, duration: 4, sourceIn: 0, tsx: { shotId: 'a', mode: 'overlay' } },
          { id: 'sh2', kind: 'tsx', timelineStart: 12, duration: 3, sourceIn: 0, tsx: { shotId: 'b', mode: 'overlay' } },
        ],
      },
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 10, sourceIn: 0 },
          { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 10, duration: 10, sourceIn: 30 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [{ id: 'm1', kind: 'audio', assetId: 'music', timelineStart: 0, duration: 30 }],
      },
    ],
    markers: [
      { id: 'mk1', time: 1 },
      { id: 'mk2', time: 5 },
      { id: 'mk3', time: 15 },
    ],
  };
}

const track = (t: StudioTimeline, id: string) => t.tracks.find((x) => x.id === id)!.clips;
const shape = (t: StudioTimeline, id: string) =>
  track(t, id).map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn ?? null]);

describe('cutSpanFromClips', () => {
  it('is a no-op for clips ending exactly at the span start', () => {
    const { clips, changed } = cutSpanFromClips(
      [{ id: 'x', kind: 'video', timelineStart: 0, duration: 4, sourceIn: 0 }],
      4,
      6,
    );
    expect(changed).toBe(false);
    expect(clips[0].timelineStart).toBe(0);
  });

  it('slides a clip starting exactly at the span end', () => {
    const { clips } = cutSpanFromClips(
      [{ id: 'x', kind: 'video', timelineStart: 6, duration: 4, sourceIn: 0 }],
      4,
      6,
    );
    expect(clips[0].timelineStart).toBe(4);
  });

  it('cuts the middle out of a straddling clip into two contiguous pieces', () => {
    const { clips } = cutSpanFromClips(
      [{ id: 'x', kind: 'video', timelineStart: 0, duration: 10, sourceIn: 5, fadeInSec: 1, fadeOutSec: 1 }],
      4,
      6,
      () => 'new',
    );
    expect(clips.map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn])).toEqual([
      ['x', 0, 4, 5],
      ['new', 4, 4, 11],
    ]);
    expect(clips[0].fadeInSec).toBe(1);
    expect(clips[0].fadeOutSec).toBeUndefined();
    expect(clips[1].fadeInSec).toBeUndefined();
    expect(clips[1].fadeOutSec).toBe(1);
  });

  it('advances the right piece by offset × speed on a sped clip', () => {
    // 10 timeline seconds at 2× play source 5 → 25; the piece after [4, 6) starts at 5 + 6 × 2.
    const { clips } = cutSpanFromClips(
      [{ id: 'x', kind: 'video', timelineStart: 0, duration: 10, sourceIn: 5, speed: 2 }],
      4,
      6,
      () => 'new',
    );
    expect(clips.map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn])).toEqual([
      ['x', 0, 4, 5],
      ['new', 4, 4, 17],
    ]);
  });

  it('keeps the id on the surviving piece and drops a clip inside the span', () => {
    const { clips } = cutSpanFromClips(
      [
        { id: 'head', kind: 'video', timelineStart: 0, duration: 5, sourceIn: 0 },
        { id: 'gone', kind: 'video', timelineStart: 5, duration: 2, sourceIn: 0 },
        { id: 'tail', kind: 'video', timelineStart: 7, duration: 5, sourceIn: 10 },
      ],
      3,
      9,
    );
    expect(clips.map((c) => [c.id, c.timelineStart, c.duration, c.sourceIn])).toEqual([
      ['head', 0, 3, 0],
      ['tail', 3, 3, 12],
    ]);
  });
});

describe('removeSpanAllTracks', () => {
  it('takes the span out of every unlocked track and the markers', () => {
    const next = removeSpanAllTracks(makeTimeline(), 4, 6);
    // c1 straddled the span: its middle is gone, the tail plays on from source 6.
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 4, 0],
      [expect.any(String), 4, 4, 6],
      ['c2', 8, 10, 30],
    ]);
    // sh1 straddled the span (2–6): keeps its first 2 s. sh2 slides by 2.
    expect(shape(next, 's1')).toEqual([
      ['sh1', 2, 2, 0],
      ['sh2', 10, 3, 0],
    ]);
    // The music bed is straddled too: 2 s cut out of its middle.
    expect(shape(next, 'a1')).toEqual([
      ['m1', 0, 4, null],
      [expect.any(String), 4, 24, 6],
    ]);
    expect(next.markers).toEqual([
      { id: 'mk1', time: 1 },
      { id: 'mk3', time: 13 },
    ]);
  });

  it('never moves a locked track', () => {
    const timeline = makeTimeline();
    timeline.tracks[2].locked = true;
    const next = removeSpanAllTracks(timeline, 4, 6);
    expect(next.tracks[2]).toBe(timeline.tracks[2]);
    expect(shape(next, 'v1').at(-1)).toEqual(['c2', 8, 10, 30]);
  });

  it('returns the identical timeline for a zero-length span', () => {
    const timeline = makeTimeline();
    expect(removeSpanAllTracks(timeline, 4, 4)).toBe(timeline);
    expect(removeSpanAllTracks(timeline, 6, 4)).toBe(timeline);
  });

  it('returns the identical timeline when the span is past everything', () => {
    const timeline = makeTimeline();
    expect(removeSpanAllTracks(timeline, 40, 42)).toBe(timeline);
  });

  it('handles a sub-frame cut in float seconds', () => {
    const next = removeSpanAllTracks(makeTimeline(), 9.95, 10);
    expect(track(next, 'v1')[0].duration).toBeCloseTo(9.95, 9);
    expect(track(next, 'v1')[1].timelineStart).toBeCloseTo(9.95, 9);
    expect(track(next, 's1')[1].timelineStart).toBeCloseTo(11.95, 9);
  });
});

describe('removeSpanFromTrack', () => {
  it('cuts one track and leaves the rest (and markers) alone', () => {
    const timeline = makeTimeline();
    const next = removeSpanFromTrack(timeline, 'v1', 4, 6);
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 4, 0],
      [expect.any(String), 4, 4, 6],
      ['c2', 8, 10, 30],
    ]);
    expect(next.tracks[0]).toBe(timeline.tracks[0]);
    expect(next.tracks[2]).toBe(timeline.tracks[2]);
    expect(next.markers).toBe(timeline.markers);
  });
});

describe('insertGapAllTracks', () => {
  it('pushes everything at or after the point right, holding straddlers', () => {
    const next = insertGapAllTracks(makeTimeline(), 10, 3, 'c1');
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 10, 0],
      ['c2', 13, 10, 30],
    ]);
    expect(shape(next, 's1')).toEqual([
      ['sh1', 2, 4, 0],
      ['sh2', 15, 3, 0],
    ]);
    expect(track(next, 'a1')[0].timelineStart).toBe(0);
    expect(next.markers?.map((m) => m.time)).toEqual([1, 5, 18]);
  });
});

describe('removeClipsRippleAll', () => {
  it('deleting a master clip removes its time from every track', () => {
    const next = removeClipsRippleAll(makeTimeline(), ['c1']);
    expect(shape(next, 'v1')).toEqual([['c2', 0, 10, 30]]);
    // sh1 lived entirely under c1: gone. sh2 slides by 10.
    expect(shape(next, 's1')).toEqual([['sh2', 2, 3, 0]]);
    expect(shape(next, 'a1')).toEqual([['m1', 0, 20, 10]]);
  });

  it('deleting a shot is a plain per-track ripple — the footage under it stays', () => {
    const timeline = makeTimeline();
    const next = removeClipsRippleAll(timeline, ['sh1']);
    expect(shape(next, 's1')).toEqual([['sh2', 8, 3, 0]]);
    expect(next.tracks[1]).toBe(timeline.tracks[1]);
    expect(next.tracks[2]).toBe(timeline.tracks[2]);
  });

  it('handles a mixed selection and several master clips in one step', () => {
    const next = removeClipsRippleAll(makeTimeline(), ['c1', 'c2', 'sh2']);
    expect(shape(next, 'v1')).toEqual([]);
    expect(shape(next, 's1')).toEqual([]);
    expect(shape(next, 'a1')).toEqual([[expect.any(String), 0, 10, 20]]);
  });
});

describe('trimClipRippleAll', () => {
  it('shortening the end of a master clip pulls every later clip left', () => {
    const next = trimClipRippleAll(makeTimeline(), 'c1', 'end', 9.5, 60);
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 9.5, 0],
      ['c2', 9.5, 10, 30],
    ]);
    expect(shape(next, 's1')).toEqual([
      ['sh1', 2, 4, 0],
      ['sh2', 11.5, 3, 0],
    ]);
    expect(track(next, 'a1').map((c) => [c.timelineStart, c.duration, c.sourceIn ?? null])).toEqual([
      [0, 9.5, null],
      [9.5, 20, 10],
    ]);
  });

  it('shortening the start keeps the clip in place and advances its source', () => {
    const next = trimClipRippleAll(makeTimeline(), 'c2', 'start', 12, 60);
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 10, 0],
      ['c2', 10, 8, 32],
    ]);
    expect(shape(next, 's1')).toEqual([
      ['sh1', 2, 4, 0],
      ['sh2', 10, 3, 0],
    ]);
  });

  it('lengthening the end pushes the neighbour instead of clamping', () => {
    const next = trimClipRippleAll(makeTimeline(), 'c1', 'end', 12, 60);
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 12, 0],
      ['c2', 12, 10, 30],
    ]);
    expect(shape(next, 's1')[1]).toEqual(['sh2', 14, 3, 0]);
    expect(next.markers?.map((m) => m.time)).toEqual([1, 5, 17]);
  });

  it('lengthening the start reveals earlier source, bounded by the source head', () => {
    // c2 starts at source 30 — asking for 5 s earlier is fine.
    const next = trimClipRippleAll(makeTimeline(), 'c2', 'start', 5, 60);
    expect(shape(next, 'v1')).toEqual([
      ['c1', 0, 10, 0],
      ['c2', 10, 15, 25],
    ]);
    expect(shape(next, 's1')[1]).toEqual(['sh2', 17, 3, 0]);
    // c1 starts at source 0 — nothing earlier to reveal.
    const timeline = makeTimeline();
    expect(trimClipRippleAll(timeline, 'c1', 'start', -2, 60)).toBe(timeline);
  });

  it('trimming a clip on another lane behaves like a plain trim', () => {
    const next = trimClipRippleAll(makeTimeline(), 'sh1', 'end', 5);
    expect(shape(next, 's1')[0]).toEqual(['sh1', 2, 3, 0]);
    expect(shape(next, 'v1')).toEqual(shape(makeTimeline(), 'v1'));
  });
});
