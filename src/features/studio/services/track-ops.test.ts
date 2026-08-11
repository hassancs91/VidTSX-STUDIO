import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import {
  addTrack,
  moveTrack,
  removeTrack,
  renameTrack,
  setTrackFlag,
} from './track-ops';

function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [{ id: 'c1', kind: 'video', assetId: 'a', timelineStart: 0, duration: 4 }],
      },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ],
  };
}

const order = (t: StudioTimeline) => t.tracks.map((track) => track.id);

describe('addTrack', () => {
  it('inserts visual tracks on top (tracks[0] paints in front)', () => {
    const next = addTrack(makeTimeline(), 'overlay', 'o1');
    expect(order(next)).toEqual(['o1', 'v1', 'a1']);
    expect(next.tracks[0]).toMatchObject({ kind: 'overlay', name: 'O1', clips: [] });
  });

  it('appends audio tracks at the bottom', () => {
    const next = addTrack(makeTimeline(), 'audio', 'a2');
    expect(order(next)).toEqual(['v1', 'a1', 'a2']);
    expect(next.tracks[2].name).toBe('A2');
  });

  it('numbers past the highest default name, ignoring renamed tracks', () => {
    let t = addTrack(makeTimeline(), 'video', 'v2'); // → V2 on top
    t = renameTrack(t, 'v1', 'Main');
    t = addTrack(t, 'video', 'v3');
    expect(t.tracks[0].name).toBe('V3');
  });
});

describe('renameTrack', () => {
  it('renames, trimming whitespace', () => {
    const next = renameTrack(makeTimeline(), 'v1', '  Main cam ');
    expect(next.tracks[0].name).toBe('Main cam');
  });

  it('rejects empty names and unknown tracks (identity)', () => {
    const t = makeTimeline();
    expect(renameTrack(t, 'v1', '   ')).toBe(t);
    expect(renameTrack(t, 'nope', 'X')).toBe(t);
    expect(renameTrack(t, 'v1', 'V1')).toBe(t);
  });
});

describe('moveTrack', () => {
  it('swaps with the neighbour in the given direction', () => {
    expect(order(moveTrack(makeTimeline(), 'v1', 1))).toEqual(['a1', 'v1']);
    expect(order(moveTrack(makeTimeline(), 'a1', -1))).toEqual(['a1', 'v1']);
  });

  it('rejects at the edges (identity)', () => {
    const t = makeTimeline();
    expect(moveTrack(t, 'v1', -1)).toBe(t);
    expect(moveTrack(t, 'a1', 1)).toBe(t);
    expect(moveTrack(t, 'nope', 1)).toBe(t);
  });
});

describe('removeTrack', () => {
  it('removes the track together with its clips', () => {
    const next = removeTrack(makeTimeline(), 'v1');
    expect(order(next)).toEqual(['a1']);
  });

  it('rejects locked tracks and the last remaining track (identity)', () => {
    const locked = setTrackFlag(makeTimeline(), 'v1', 'locked', true);
    expect(removeTrack(locked, 'v1')).toBe(locked);

    const single = removeTrack(makeTimeline(), 'v1');
    expect(removeTrack(single, 'a1')).toBe(single);
  });
});

describe('setTrackFlag', () => {
  it('sets and clears a flag', () => {
    const muted = setTrackFlag(makeTimeline(), 'a1', 'muted', true);
    expect(muted.tracks[1].muted).toBe(true);
    const unmuted = setTrackFlag(muted, 'a1', 'muted', false);
    expect(unmuted.tracks[1].muted).toBe(false);
  });

  it('is identity when the value is already set', () => {
    const t = makeTimeline();
    expect(setTrackFlag(t, 'v1', 'hidden', false)).toBe(t);
    const hidden = setTrackFlag(t, 'v1', 'hidden', true);
    expect(setTrackFlag(hidden, 'v1', 'hidden', true)).toBe(hidden);
  });
});
