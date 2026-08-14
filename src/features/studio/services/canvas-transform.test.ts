import { describe, it, expect } from 'vitest';
import type { SerializedTimeline } from '@shared/studio';
import {
  MAX_OFFSET,
  MAX_SCALE,
  MIN_SCALE,
  clipBox,
  fitScale,
  hitTestClip,
  moveGesture,
  overrideClipTransform,
  playerPointToComp,
  scaleGesture,
} from './canvas-transform';

const COMP = { width: 1920, height: 1080 };

describe('fitScale / playerPointToComp', () => {
  it('maps player pixels to composition pixels at a 0.5 fit', () => {
    const rect = { width: 960, height: 540 };
    expect(fitScale(rect, COMP)).toBe(0.5);
    expect(playerPointToComp({ x: 480, y: 270 }, rect, COMP)).toEqual({ x: 960, y: 540 });
  });

  it('handles a portrait composition and a fit above 1', () => {
    const comp = { width: 1080, height: 1920 };
    expect(fitScale({ width: 270, height: 480 }, comp)).toBe(0.25);
    expect(playerPointToComp({ x: 27, y: 96 }, { width: 270, height: 480 }, comp)).toEqual({
      x: 108,
      y: 384,
    });
    // A player larger than the composition scales points DOWN.
    expect(playerPointToComp({ x: 2160, y: 0 }, { width: 2160, height: 3840 }, comp)).toEqual({
      x: 1080,
      y: 0,
    });
  });

  it('guards sub-pixel layout noise with min() and a zero rect with 0', () => {
    // A rect a hair taller than the aspect ratio must not inflate coordinates.
    expect(fitScale({ width: 960, height: 540.4 }, COMP)).toBe(0.5);
    expect(fitScale({ width: 0, height: 0 }, COMP)).toBe(0);
    expect(playerPointToComp({ x: 10, y: 10 }, { width: 0, height: 0 }, COMP)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('clipBox', () => {
  it('is the full composition for an identity transform', () => {
    expect(clipBox(COMP, undefined)).toEqual({ left: 0, top: 0, width: 1920, height: 1080 });
    expect(clipBox(COMP, { opacity: 0.5 })).toEqual({ left: 0, top: 0, width: 1920, height: 1080 });
  });

  it('offsets by x/y in un-scaled composition pixels', () => {
    expect(clipBox(COMP, { x: 100, y: -50 })).toEqual({
      left: 100,
      top: -50,
      width: 1920,
      height: 1080,
    });
  });

  it('scales about the (translated) center', () => {
    expect(clipBox(COMP, { scale: 0.5 })).toEqual({ left: 480, top: 270, width: 960, height: 540 });
    expect(clipBox(COMP, { x: 100, y: 40, scale: 0.5 })).toEqual({
      left: 580,
      top: 310,
      width: 960,
      height: 540,
    });
  });
});

describe('moveGesture', () => {
  it('applies a composition-space delta to the starting transform', () => {
    expect(moveGesture(undefined, { x: 150, y: -60 })).toEqual({ x: 150, y: -60 });
    expect(moveGesture({ x: 100, y: 20, scale: 0.5 }, { x: -30, y: 5 })).toEqual({ x: 70, y: 25 });
  });

  it('returns the starting values for a zero delta (no-op gesture)', () => {
    expect(moveGesture({ x: 42, y: -7 }, { x: 0, y: 0 })).toEqual({ x: 42, y: -7 });
    expect(moveGesture(undefined, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('rounds to whole pixels and clamps to the inspector range', () => {
    expect(moveGesture(undefined, { x: 10.4, y: 10.6 })).toEqual({ x: 10, y: 11 });
    expect(moveGesture({ x: 9990 }, { x: 500, y: -20000 })).toEqual({
      x: MAX_OFFSET,
      y: -MAX_OFFSET,
    });
  });
});

describe('scaleGesture', () => {
  it('doubles the scale dragging SE outward, keeping NW anchored', () => {
    // Identity box: NW corner (0,0), SE corner (1920,1080). Pointer at twice
    // the diagonal lands exactly on scale 2.
    const result = scaleGesture(COMP, undefined, 'se', { x: 3840, y: 2160 });
    expect(result.scale).toBe(2);
    const box = clipBox(COMP, result);
    expect(box.left).toBe(0);
    expect(box.top).toBe(0);
    expect(box.width).toBe(3840);
  });

  it('keeps the opposite corner anchored for a NW drag on an offset clip', () => {
    // Start: x 100, y 50, scale 0.5 → box (580,310)–(1540,850); SE anchored.
    const start = { x: 100, y: 50, scale: 0.5 };
    const before = clipBox(COMP, start);
    const anchor = { x: before.left + before.width, y: before.top + before.height };
    // Drag the NW corner outward along the diagonal to scale 0.75.
    const pointer = { x: anchor.x - 1920 * 0.75, y: anchor.y - 1080 * 0.75 };
    const result = scaleGesture(COMP, start, 'nw', pointer);
    expect(result.scale).toBe(0.75);
    const after = clipBox(COMP, result);
    expect(after.left + after.width).toBeCloseTo(anchor.x, 6);
    expect(after.top + after.height).toBeCloseTo(anchor.y, 6);
  });

  it('projects an off-diagonal pointer onto the diagonal', () => {
    // Pulling straight right from the SE corner grows the box by the x
    // component only — the projection keeps the gesture stable instead of
    // snapping to whichever axis moved last.
    const result = scaleGesture(COMP, undefined, 'se', { x: 3840, y: 1080 });
    const expected = (3840 * 1920 + 1080 * 1080) / (1920 * 1920 + 1080 * 1080);
    expect(result.scale).toBeCloseTo(expected, 3);
  });

  it('clamps at MIN_SCALE past the anchor instead of inverting', () => {
    // Dragging the SE handle beyond the NW anchor would invert the box.
    const result = scaleGesture(COMP, undefined, 'se', { x: -500, y: -500 });
    expect(result.scale).toBe(MIN_SCALE);
    // Anchor (the NW corner at 0,0) still holds at the clamped scale, within
    // the half-pixel that x/y rounding to whole pixels allows.
    const box = clipBox(COMP, result);
    expect(box.left).toBeCloseTo(0, 0);
    expect(box.top).toBeCloseTo(0, 0);
  });

  it('clamps at MAX_SCALE', () => {
    expect(scaleGesture(COMP, undefined, 'se', { x: 1e6, y: 1e6 }).scale).toBe(MAX_SCALE);
  });

  it('is an identity when the pointer sits on the starting corner', () => {
    const start = { x: 100, y: 50, scale: 0.5 };
    const box = clipBox(COMP, start);
    const result = scaleGesture(COMP, start, 'se', {
      x: box.left + box.width,
      y: box.top + box.height,
    });
    expect(result).toEqual({ x: 100, y: 50, scale: 0.5 });
  });
});

function makeSerialized(): SerializedTimeline {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    tracks: [
      {
        id: 'overlay',
        kind: 'overlay',
        clips: [
          // A scaled-down TSX shot top-left: box (0,0)–(480,270).
          {
            id: 'shot1',
            kind: 'tsx',
            from: 0,
            durationInFrames: 150,
            transform: { x: -720, y: -405, scale: 0.25 },
            tsx: { shotId: 's1', mode: 'overlay' },
          },
        ],
      },
      {
        id: 'v1',
        kind: 'video',
        clips: [
          { id: 'clipA', kind: 'video', from: 0, durationInFrames: 100, src: 'a' },
          { id: 'clipB', kind: 'video', from: 100, durationInFrames: 100, src: 'b' },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        clips: [{ id: 'music', kind: 'audio', from: 0, durationInFrames: 300, src: 'm' }],
      },
    ],
  };
}

describe('hitTestClip', () => {
  it('picks the topmost painted clip (tracks[0] wins over lower lanes)', () => {
    // (100,100) is inside both the shot's box and the full-frame video.
    expect(hitTestClip(makeSerialized(), 10, { x: 100, y: 100 })).toBe('shot1');
  });

  it('falls through to lower lanes outside the top clip box', () => {
    expect(hitTestClip(makeSerialized(), 10, { x: 960, y: 540 })).toBe('clipA');
  });

  it('respects the frame window and never returns audio clips', () => {
    // Frame 160: the shot (ends at 150) and clipA (ends at 100) are over;
    // only clipB paints. The music clip spans the frame but has no pixels.
    expect(hitTestClip(makeSerialized(), 160, { x: 100, y: 100 })).toBe('clipB');
    // Frame 100 is clipA's exclusive end and clipB's inclusive start.
    expect(hitTestClip(makeSerialized(), 100, { x: 960, y: 540 })).toBe('clipB');
    // Frame 200 is past every visual clip.
    expect(hitTestClip(makeSerialized(), 200, { x: 960, y: 540 })).toBeNull();
  });

  it('returns null outside every box', () => {
    const timeline = makeSerialized();
    // Shrink the only frame-0 video too, so (1900, 1000) hits nothing.
    timeline.tracks[1].clips[0].transform = { scale: 0.5 };
    expect(hitTestClip(timeline, 150, { x: 100, y: 100 })).toBe('clipB');
    expect(
      hitTestClip({ ...timeline, tracks: [timeline.tracks[0], timeline.tracks[2]] }, 10, {
        x: 1900,
        y: 1000,
      }),
    ).toBeNull();
  });

  it('prefers the trailing clip through a same-track overlap (crossfade paint order)', () => {
    const timeline = makeSerialized();
    // Extend clipA to overlap clipB's head, the crossfade serialization shape.
    timeline.tracks[1].clips[0].durationInFrames = 120;
    expect(hitTestClip(timeline, 110, { x: 960, y: 540 })).toBe('clipB');
  });
});

describe('overrideClipTransform', () => {
  it('merges the override over the existing transform, preserving other fields', () => {
    const timeline = makeSerialized();
    timeline.tracks[1].clips[0].transform = { opacity: 0.8 };
    const next = overrideClipTransform(timeline, 'clipA', { x: 50, y: 10 });
    expect(next.tracks[1].clips[0].transform).toEqual({ opacity: 0.8, x: 50, y: 10 });
    // Untouched structures keep their identity; the changed path is new.
    expect(next).not.toBe(timeline);
    expect(next.tracks[0]).toBe(timeline.tracks[0]);
    expect(next.tracks[1]).not.toBe(timeline.tracks[1]);
    // The source timeline was not mutated.
    expect(timeline.tracks[1].clips[0].transform).toEqual({ opacity: 0.8 });
  });

  it('returns the same object when the clip is not in the serialization', () => {
    const timeline = makeSerialized();
    expect(overrideClipTransform(timeline, 'nope', { x: 1 })).toBe(timeline);
  });
});
