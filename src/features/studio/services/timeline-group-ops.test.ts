import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import {
  clipsInRect,
  moveClips,
  pasteClips,
  removeClips,
  updateClips,
  type ClipboardEntry,
} from './timeline-group-ops';

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

describe('updateClips', () => {
  it('applies one patch to every selected clip across tracks', () => {
    const next = updateClips(makeTimeline(), ['c1', 'm1'], { gain: 0 });
    expect(next.tracks[0].clips[0].gain).toBe(0);
    expect(next.tracks[1].clips[0].gain).toBe(0);
    expect(next.tracks[0].clips[1].gain).toBeUndefined();
  });

  it('rejects the whole batch when any member is on a locked track', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].locked = true;
    expect(updateClips(timeline, ['c1', 'm1'], { gain: 0 })).toBe(timeline);
  });

  it('is identity when nothing changes or no clip matches', () => {
    const timeline = makeTimeline();
    expect(updateClips(timeline, ['c1', 'c2'], { gain: 1 })).toBe(timeline);
    expect(updateClips(timeline, ['nope'], { gain: 0 })).toBe(timeline);
  });
});

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

describe('pasteClips', () => {
  /** Clipboard holding c2 + c3 (offsets 0 and 5 from the group start). */
  function copyOfC2C3(): ClipboardEntry[] {
    const t = makeTimeline();
    return [
      { clip: { ...t.tracks[0].clips[1] }, trackId: 'v1', offsetSeconds: 0 },
      { clip: { ...t.tracks[0].clips[2] }, trackId: 'v1', offsetSeconds: 5 },
    ];
  }

  it('pastes on the source tracks with relative layout and fresh ids', () => {
    const next = pasteClips(makeTimeline(), copyOfC2C3(), 20, ['p1', 'p2']);
    expect(v1(next)).toEqual([
      ['c1', 0],
      ['c2', 5],
      ['c3', 10],
      ['p1', 20],
      ['p2', 25],
    ]);
    // The paste is a copy, not a move — source fields ride along.
    const p1 = next.tracks[0].clips.find((c) => c.id === 'p1');
    expect(p1).toMatchObject({ kind: 'video', assetId: 'a', sourceIn: 10, duration: 3 });
  });

  it('shifts the WHOLE group right to the nearest fit on collision', () => {
    // Desired [0,3) + [5,7) collide with c1/c2; first delta where both fit is
    // 12 (right after c3) — the layout is never torn apart to fill gaps.
    const next = pasteClips(makeTimeline(), copyOfC2C3(), 0, ['p1', 'p2']);
    expect(v1(next)).toEqual([
      ['c1', 0],
      ['c2', 5],
      ['c3', 10],
      ['p1', 12],
      ['p2', 17],
    ]);
  });

  it('keeps cross-track groups aligned when one track forces a shift', () => {
    // At 4 the video copy hits c2 and the audio copy hits m1. Candidate
    // shifts that free ONE track still collide on the other (8→ hits c3,
    // 11→ still under c3) — the first delta where BOTH lanes are free puts
    // both copies at 12, still perfectly aligned.
    const t = makeTimeline();
    const entries: ClipboardEntry[] = [
      { clip: { ...t.tracks[0].clips[1] }, trackId: 'v1', offsetSeconds: 0 },
      { clip: { ...t.tracks[1].clips[1] }, trackId: 'a1', offsetSeconds: 0 },
    ];
    const next = pasteClips(t, entries, 4, ['p1', 'p2']);
    expect(v1(next)).toContainEqual(['p1', 12]);
    expect(a1(next)).toContainEqual(['p2', 12]);
  });

  it('falls back to the first compatible track when the source track is gone', () => {
    const t = makeTimeline();
    const entries: ClipboardEntry[] = [
      { clip: { ...t.tracks[1].clips[1] }, trackId: 'deleted-track', offsetSeconds: 0 },
    ];
    const next = pasteClips(t, entries, 20, ['p1']);
    expect(a1(next)).toContainEqual(['p1', 20]);
    expect(v1(next)).toEqual(v1(t)); // never lands an audio clip on a video lane
  });

  it('rejects when no track can hold an entry (locked or wrong kind)', () => {
    const t = makeTimeline();
    t.tracks[1].locked = true; // the only audio lane
    const entries: ClipboardEntry[] = [
      { clip: { ...t.tracks[1].clips[0] }, trackId: 'a1', offsetSeconds: 0 },
    ];
    expect(pasteClips(t, entries, 20)).toBe(t);
  });

  it('rejects a group that overlaps itself after track fallback', () => {
    const t = makeTimeline();
    const entries: ClipboardEntry[] = [
      { clip: { ...t.tracks[0].clips[0] }, trackId: 'v1', offsetSeconds: 0 }, // dur 4
      { clip: { ...t.tracks[0].clips[0], id: 'cx' }, trackId: 'v-gone', offsetSeconds: 2 },
    ];
    expect(pasteClips(t, entries, 20)).toBe(t);
    expect(pasteClips(t, [], 20)).toBe(t);
  });

  it('clamps a negative paste position to zero', () => {
    const t: StudioTimeline = {
      tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips: [] }],
    };
    const entries: ClipboardEntry[] = [
      { clip: { id: 'c', kind: 'video', timelineStart: 9, duration: 2 }, trackId: 'v1', offsetSeconds: 0 },
    ];
    const next = pasteClips(t, entries, -5, ['p1']);
    expect(next.tracks[0].clips).toEqual([expect.objectContaining({ id: 'p1', timelineStart: 0 })]);
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
