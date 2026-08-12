import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import {
  addClip,
  clipAt,
  findClip,
  findFreeSlot,
  moveClip,
  removeClip,
  setClipSpeed,
  splitClip,
  trimClip,
  updateClip,
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

describe('updateClip', () => {
  it('patches gain, clamped to 0–2', () => {
    const next = updateClip(makeTimeline(), 'c1', { gain: 5 });
    expect(findClip(next, 'c1')!.clip.gain).toBe(2);
    const muted = updateClip(makeTimeline(), 'c1', { gain: 0 });
    expect(findClip(muted, 'c1')!.clip.gain).toBe(0);
  });

  it('stores neutral values by removing the key (gain 1, empty label)', () => {
    const withGain = updateClip(makeTimeline(), 'c1', { gain: 0.5 });
    const back = updateClip(withGain, 'c1', { gain: 1 });
    expect('gain' in findClip(back, 'c1')!.clip).toBe(false);

    const labelled = updateClip(makeTimeline(), 'c1', { label: 'Intro' });
    expect(findClip(labelled, 'c1')!.clip.label).toBe('Intro');
    const cleared = updateClip(labelled, 'c1', { label: '   ' });
    expect('label' in findClip(cleared, 'c1')!.clip).toBe(false);
  });

  it('merges transform field-wise and drops neutral fields', () => {
    const step1 = updateClip(makeTimeline(), 'c1', { transform: { opacity: 0.5 } });
    const step2 = updateClip(step1, 'c1', { transform: { x: 100, rotation: 45 } });
    expect(findClip(step2, 'c1')!.clip.transform).toEqual({ opacity: 0.5, x: 100, rotation: 45 });
    // Resetting every field back to neutral removes the transform entirely.
    const reset = updateClip(step2, 'c1', { transform: { opacity: 1, x: 0, rotation: 0 } });
    expect('transform' in findClip(reset, 'c1')!.clip).toBe(false);
  });

  it('rejects unknown clip, locked track, and no-change patches (identity)', () => {
    const timeline = makeTimeline();
    expect(updateClip(timeline, 'missing', { gain: 0.5 })).toBe(timeline);
    expect(updateClip(timeline, 'c1', { gain: 1, label: '', transform: { scale: 1 } })).toBe(
      timeline,
    );
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(updateClip(locked, 'c1', { gain: 0.5 })).toBe(locked);
  });
});

describe('setClipSpeed', () => {
  it('2× halves the duration in place, timelineStart and sourceIn untouched', () => {
    const next = setClipSpeed(makeTimeline(), 'c1', 2);
    const clip = findClip(next, 'c1')!.clip;
    expect(clip.timelineStart).toBe(0);
    expect(clip.duration).toBe(2.5);
    expect(clip.sourceIn).toBe(0);
    expect(clip.speed).toBe(2);
  });

  it('slowing down clamps against the next clip like an end-trim', () => {
    // c1 at 0.5× wants 10 s but c2 starts at 5 — boxed in, duration stays 5.
    const next = setClipSpeed(makeTimeline(), 'c1', 0.5);
    const clip = findClip(next, 'c1')!.clip;
    expect(clip.duration).toBe(5);
    expect(clip.speed).toBe(0.5);
    // The last clip on the track has open space — it really lengthens.
    const tail = setClipSpeed(makeTimeline(), 'c2', 0.5);
    expect(findClip(tail, 'c2')!.clip.duration).toBe(10);
  });

  it('round-trips: back to 1× restores the original duration and drops the key', () => {
    const fast = setClipSpeed(makeTimeline(), 'c2', 4);
    expect(findClip(fast, 'c2')!.clip.duration).toBe(1.25);
    const back = setClipSpeed(fast, 'c2', 1);
    const clip = findClip(back, 'c2')!.clip;
    expect(clip.duration).toBe(5);
    expect('speed' in clip).toBe(false);
  });

  it('rejects when the sped-up clip falls under the minimum duration', () => {
    const timeline = makeTimeline();
    timeline.tracks[0].clips[0].duration = 0.1;
    expect(setClipSpeed(timeline, 'c1', 4)).toBe(timeline);
  });

  it('rejects invalid speeds, locked tracks, and same-speed calls (identity)', () => {
    const timeline = makeTimeline();
    expect(setClipSpeed(timeline, 'c1', 0)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', -1)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', Number.NaN)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', 1)).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(setClipSpeed(locked, 'c1', 2)).toBe(locked);
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
