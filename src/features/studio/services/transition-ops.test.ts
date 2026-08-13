import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '../types';
import { removeClip, splitClip, trimClip } from './timeline-ops';
import { moveClips } from './timeline-group-ops';
import { pruneTransitions, removeTransition, setTransition } from './transition-ops';

/** V1: a|b|c contiguous 0–4–8–12, plus a gapped clip d at 20. */
function base(locked = false): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        locked,
        clips: [
          { id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0 },
          { id: 'b', kind: 'video', assetId: 'x', timelineStart: 4, duration: 4, sourceIn: 10 },
          { id: 'c', kind: 'video', assetId: 'x', timelineStart: 8, duration: 4, sourceIn: 20 },
          { id: 'd', kind: 'video', assetId: 'x', timelineStart: 20, duration: 4, sourceIn: 30 },
        ],
      },
    ],
  };
}

function withTransition(kind: 'crossfade' | 'dip-to-black' = 'crossfade', duration = 1) {
  return setTransition(base(), 'a', kind, duration);
}

const clip = (t: StudioTimeline, id: string) =>
  t.tracks.flatMap((tr) => tr.clips).find((c) => c.id === id)!;

describe('setTransition', () => {
  it('sets on a contiguous boundary and clamps to both clip lengths', () => {
    const next = setTransition(base(), 'a', 'crossfade', 1);
    expect(clip(next, 'a').transitionOut).toEqual({ kind: 'crossfade', duration: 1 });
    const huge = setTransition(base(), 'a', 'dip-to-black', 99);
    expect(clip(huge, 'a').transitionOut?.duration).toBe(4);
  });

  it('rejects: no contiguous next clip, unknown clip, locked track, bad duration', () => {
    const t = base();
    expect(setTransition(t, 'c', 'crossfade', 1)).toBe(t); // next is at 20, gap
    expect(setTransition(t, 'd', 'crossfade', 1)).toBe(t); // last clip
    expect(setTransition(t, 'nope', 'crossfade', 1)).toBe(t);
    const lockedTimeline = base(true);
    expect(setTransition(lockedTimeline, 'a', 'crossfade', 1)).toBe(lockedTimeline);
    expect(setTransition(t, 'a', 'crossfade', 0.01)).toBe(t);
    expect(setTransition(t, 'a', 'crossfade', Number.NaN)).toBe(t);
  });

  it('is identity when re-setting the same kind and duration', () => {
    const once = withTransition();
    expect(setTransition(once, 'a', 'crossfade', 1)).toBe(once);
  });
});

describe('removeTransition', () => {
  it('removes the field entirely', () => {
    const next = removeTransition(withTransition(), 'a');
    expect('transitionOut' in clip(next, 'a')).toBe(false);
  });

  it('is identity when absent', () => {
    const t = base();
    expect(removeTransition(t, 'a')).toBe(t);
  });
});

describe('pruneTransitions (the reducer invariant)', () => {
  it('is identity on a clean timeline', () => {
    const t = withTransition();
    expect(pruneTransitions(t)).toBe(t);
    const empty = base();
    expect(pruneTransitions(empty)).toBe(empty);
  });

  it('drops the transition when an end-trim opens a gap', () => {
    const t = trimClip(withTransition(), 'a', 'end', 3);
    const pruned = pruneTransitions(t);
    expect(clip(t, 'a').duration).toBe(3);
    expect('transitionOut' in clip(pruned, 'a')).toBe(false);
  });

  it('drops it when the trailing clip is trimmed or moved away', () => {
    const trimmed = pruneTransitions(trimClip(withTransition(), 'b', 'start', 5));
    expect('transitionOut' in clip(trimmed, 'a')).toBe(false);
    // b is boxed in (flush both sides), so use the b→c boundary: c has room.
    const onB = setTransition(base(), 'b', 'crossfade', 1);
    const moved = pruneTransitions(moveClips(onB, ['c'], 1.5));
    expect(clip(moved, 'c').timelineStart).toBe(9.5);
    expect('transitionOut' in clip(moved, 'b')).toBe(false);
  });

  it('drops it when the trailing clip is deleted without ripple', () => {
    const t = pruneTransitions(removeClip(withTransition(), 'b', false));
    expect('transitionOut' in clip(t, 'a')).toBe(false);
  });

  it('KEEPS it when a ripple delete slides the next clip flush', () => {
    const t = pruneTransitions(removeClip(withTransition(), 'b', true));
    // c slid from 8 to 4 — a's boundary is contiguous again, transition survives.
    expect(clip(t, 'c').timelineStart).toBe(4);
    expect(clip(t, 'a').transitionOut).toEqual({ kind: 'crossfade', duration: 1 });
  });
});

describe('splitClip transition inheritance', () => {
  it('right half keeps transitionOut, left half drops it', () => {
    const t = splitClip(withTransition(), 'a', 2, 'a2');
    expect('transitionOut' in clip(t, 'a')).toBe(false);
    expect(clip(t, 'a2').transitionOut).toEqual({ kind: 'crossfade', duration: 1 });
    // And the pair is contiguous, so a prune changes nothing.
    expect(pruneTransitions(t)).toBe(t);
  });
});
