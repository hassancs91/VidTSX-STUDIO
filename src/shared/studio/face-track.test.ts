import { describe, expect, it } from 'vitest';
import type { FilterFace } from '../types/studio-effects';
import {
  FACE_TRACK_VERSION,
  faceTrackCompatible,
  faceTrackRelPath,
  facesAt,
  mergeFaceTrack,
  mergeSpans,
  missingSpans,
  parseFaceTrack,
  roundFace,
  serializeFaceTrack,
  settledSpanEnd,
  spansCovered,
  type FaceTrack,
} from './face-track';

const face = (x: number, mouthOpen = 0.123456): FilterFace => ({
  center: { x, y: 0.5 },
  width: 0.2,
  height: 0.3,
  rotation: -0.1,
  leftEye: { x: x - 0.05, y: 0.45 },
  rightEye: { x: x + 0.05, y: 0.45 },
  nose: { x, y: 0.5 },
  mouth: { x, y: 0.58 },
  forehead: { x, y: 0.35 },
  mouthOpen,
});

const track = (frames: FaceTrack['frames'], overrides: Partial<FaceTrack> = {}): FaceTrack => ({
  version: FACE_TRACK_VERSION,
  kind: 'faces',
  source: { width: 960, height: 512 },
  fps: 30,
  spans: [[0, 1]],
  ep: 'dml',
  models: { yunet: 'aaa', 'face-mesh': 'bbb' },
  generatedAt: '2026-09-24T00:00:00.000Z',
  frames,
  ...overrides,
});

describe('face track format', () => {
  it('names the cache file per asset', () => {
    expect(faceTrackRelPath('asset-a')).toBe('analysis/asset-a/faces-v1.json');
  });

  it('rounds a Face record to four decimals', () => {
    const rounded = roundFace({ ...face(0.123456789), rotation: -0.00004 });
    expect(rounded.center).toEqual({ x: 0.1235, y: 0.5 });
    expect(rounded.mouthOpen).toBe(0.1235);
    expect(rounded.rotation).toBe(-0);
    expect(rounded.leftEye).toEqual({ x: 0.0735, y: 0.45 });
  });

  it('round-trips through the file text with frames sorted and unique', () => {
    const t = track([
      { t: 0.06667, faces: [roundFace(face(0.5))] },
      { t: 0, faces: [] },
      { t: 0.03333, faces: [roundFace(face(0.4)), roundFace(face(0.7))] },
      { t: 0.06667, faces: [roundFace(face(0.9))] },
    ]);
    const text = serializeFaceTrack(t);
    expect(text.split('\n').length).toBe(6); // header line + 4 frames + closing
    const parsed = parseFaceTrack(JSON.parse(text));
    expect(parsed).not.toBeNull();
    expect(parsed!.frames.map((f) => f.t)).toEqual([0, 0.03333, 0.06667]);
    expect(parsed!.frames[2].faces[0].center.x).toBe(0.9);
    expect(parsed!.frames[1].faces).toHaveLength(2);
    expect(parsed!.ep).toBe('dml');
    expect(parsed!.models).toEqual({ yunet: 'aaa', 'face-mesh': 'bbb' });
  });

  it('refuses another version, a bad frame and a malformed face', () => {
    expect(parseFaceTrack({ ...track([]), version: 2 })).toBeNull();
    expect(parseFaceTrack({ ...track([]), frames: [{ t: 'x', faces: [] }] })).toBeNull();
    expect(parseFaceTrack({ ...track([]), frames: [{ t: 0, faces: [{ center: { x: 0.5 } }] }] })).toBeNull();
    expect(parseFaceTrack({ ...track([]), frames: [{ t: 0, faces: [{ ...face(0.5), width: 0 }] }] })).toBeNull();
    expect(parseFaceTrack({ ...track([]), ep: 'cuda' })).toBeNull();
    expect(parseFaceTrack(null)).toBeNull();
  });
});

describe('spans', () => {
  it('merges overlapping and touching spans in order', () => {
    expect(mergeSpans([[5, 6], [0, 2], [1.5, 3], [3, 4]])).toEqual([[0, 4], [5, 6]]);
    expect(mergeSpans([[0, 1], [1.02, 2]], 0.05)).toEqual([[0, 2]]);
    expect(mergeSpans([[0, 1], [1.2, 2]], 0.05)).toEqual([[0, 1], [1.2, 2]]);
  });

  it('finds what a request still needs, within one frame of tolerance', () => {
    const tol = 1 / 30;
    expect(missingSpans([[0, 4]], [[1, 3]], tol)).toEqual([]);
    expect(missingSpans([[0, 4]], [[0, 4.02]], tol)).toEqual([]);
    expect(missingSpans([[0, 4]], [[2, 6]], tol)).toEqual([[4, 6]]);
    expect(missingSpans([[2, 4]], [[0, 6]], tol)).toEqual([[0, 2], [4, 6]]);
    expect(missingSpans([], [[1, 2]], tol)).toEqual([[1, 2]]);
    expect(missingSpans([[0, 1], [3, 4]], [[0.5, 3.5]], tol)).toEqual([[1, 3]]);
    expect(spansCovered([[0, 4]], [[1, 3.99]], tol)).toBe(true);
    expect(spansCovered([[0, 4]], [[1, 5]], tol)).toBe(false);
  });
});

describe('settledSpanEnd', () => {
  it('settles a run at its last frame, and never short of the span asked for', () => {
    // 30 fps, asked for [0, 39.385] (the probe), got 1181 frames: the last is at 39.333.
    expect(settledSpanEnd(39.385, 0, 1181, 30)).toBe(39.385);
    // Asked for [2, 4], the grid run delivers one frame past the end.
    expect(settledSpanEnd(4, 2, 61, 30)).toBe(4);
    expect(settledSpanEnd(4, 2, 70, 30)).toBeCloseTo(4.3, 6);
    // A one-frame tail request on an exhausted source counts as settled.
    expect(spansCovered([[0, settledSpanEnd(39.385, 39.333, 1, 30)]], [[0, 39.385]], 1 / 30)).toBe(true);
  });
});

describe('mergeFaceTrack', () => {
  it('unions frames by time, the addition winning, and merges the spans', () => {
    const existing = track([{ t: 0, faces: [face(0.1)] }, { t: 0.03333, faces: [face(0.2)] }], { spans: [[0, 0.03333]] });
    const addition = track([{ t: 0.03333, faces: [face(0.25)] }, { t: 0.06667, faces: [face(0.3)] }], { spans: [[0.03333, 0.06667]], ep: 'cpu' });
    const merged = mergeFaceTrack(existing, addition);
    expect(merged.frames.map((f) => [f.t, f.faces[0].center.x])).toEqual([[0, 0.1], [0.03333, 0.25], [0.06667, 0.3]]);
    expect(merged.spans).toEqual([[0, 0.06667]]);
    expect(merged.ep).toBe('cpu');
  });

  it('discards a cache made with other models or another rate', () => {
    const existing = track([{ t: 0, faces: [face(0.1)] }]);
    const otherModels = track([{ t: 1, faces: [] }], { models: { yunet: 'zzz', 'face-mesh': 'bbb' }, spans: [[1, 1]] });
    expect(faceTrackCompatible(existing, otherModels)).toBe(false);
    expect(mergeFaceTrack(existing, otherModels).frames.map((f) => f.t)).toEqual([1]);
    expect(faceTrackCompatible(existing, { ...existing, fps: 24 })).toBe(false);
    expect(faceTrackCompatible(existing, { ...existing })).toBe(true);
  });
});

describe('facesAt', () => {
  const t = track([
    { t: 0, faces: [face(0.1)] },
    { t: 0.03333, faces: [face(0.2)] },
    { t: 0.06667, faces: [] },
    { t: 1, faces: [face(0.9)] },
  ]);

  it('returns the nearest frame within half a frame, else nothing', () => {
    expect(facesAt(t, 0)[0].center.x).toBe(0.1);
    expect(facesAt(t, 0.034)[0].center.x).toBe(0.2);
    expect(facesAt(t, 0.0166)[0].center.x).toBe(0.1); // just under the midpoint
    expect(facesAt(t, 0.0167)[0].center.x).toBe(0.2); // just over it
    expect(facesAt(t, 0.06667)).toEqual([]); // a frame with no face is "no face", not the neighbour's
    expect(facesAt(t, 0.5)).toEqual([]); // a gap in the track
    expect(facesAt(t, 1.016)[0].center.x).toBe(0.9);
    expect(facesAt(t, 1.02)).toEqual([]);
    expect(facesAt(t, Number.NaN)).toEqual([]);
  });

  it('a static track answers at every time', () => {
    const still = track([{ t: 0, faces: [face(0.4)] }], { static: true, fps: 1 });
    expect(facesAt(still, 0)[0].center.x).toBe(0.4);
    expect(facesAt(still, 37.5)[0].center.x).toBe(0.4);
    expect(facesAt(track([], { static: true }), 3)).toEqual([]);
  });
});
