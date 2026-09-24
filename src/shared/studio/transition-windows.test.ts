import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioProject } from '../types/studio';
import { clipVolumeAt } from './export-audio';
import { serializeTimeline, type SerializedClip } from './serialize';
import {
  coverByClip,
  isCovered,
  isNativeTransitionKind,
  planTransitionWindows,
  usesEqualPowerAudio,
} from './transition-windows';

const FPS = 30;
const PUSH = 'core/push-left';

function project(clips: StudioClip[]): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1280, height: 720, fps: FPS, agent: {} },
    assets: [
      { id: 'x', kind: 'video', path: 'C:/x.mp4', probe: { duration: 40, hasAudio: true } },
      { id: 'music', kind: 'audio', path: 'C:/m.mp3', probe: { duration: 40, hasAudio: true } },
    ],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] },
    proposals: [],
    shots: [],
  };
}

/** The serializer's real output — the planner re-checks its geometry, so hand-built clips would prove nothing. */
function serialized(clips: StudioClip[]): SerializedClip[] {
  return serializeTimeline(project(clips), () => 'http://x/asset').tracks[0].clips;
}

function video(id: string, timelineStart: number, sourceIn: number, extra: Partial<StudioClip> = {}): StudioClip {
  return { id, kind: 'video', assetId: 'x', timelineStart, duration: 4, sourceIn, ...extra };
}

const installed = (kind: string) => kind === PUSH;

describe('transition kinds', () => {
  it('knows the two the engine draws itself', () => {
    expect(isNativeTransitionKind('crossfade')).toBe(true);
    expect(isNativeTransitionKind('dip-to-black')).toBe(true);
    expect(isNativeTransitionKind(PUSH)).toBe(false);
  });

  it('dips linearly and hands everything else off at equal power', () => {
    expect(usesEqualPowerAudio('dip-to-black')).toBe(false);
    expect(usesEqualPowerAudio('crossfade')).toBe(true);
    expect(usesEqualPowerAudio(PUSH)).toBe(true);
    // An id from a build newer than this one, or a pack nobody has: still a hand-off.
    expect(usesEqualPowerAudio('someone/unknown')).toBe(true);
  });
});

describe('serializeTimeline with a pack transition', () => {
  it('gives it the crossfade overlap, carrying the namespaced id through', () => {
    const [a, b] = serialized([
      video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }),
      video('b', 4, 10),
    ]);
    // Identical numbers to the crossfade case in serialize.test.ts.
    expect(a).toMatchObject({ from: 0, durationInFrames: 135, transitionOut: { kind: PUSH, frames: 30 } });
    expect(b).toMatchObject({ from: 105, durationInFrames: 135, trimBefore: 285, transitionIn: { kind: PUSH, frames: 30 } });
  });
});

describe('planTransitionWindows', () => {
  const pushPair = () =>
    serialized([video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }), video('b', 4, 10)]);

  it('opens a window over the overlap of an installed pack transition', () => {
    expect(planTransitionWindows(pushPair(), installed)).toEqual([
      { id: 'a', kind: PUSH, leadId: 'a', trailId: 'b', from: 105, frames: 30 },
    ]);
  });

  it('follows the serializer when handles clamp the overlap', () => {
    // 6 frames of head handle on the trailing clip → a 21-frame overlap from frame 114.
    const clips = serialized([
      video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }),
      video('b', 4, 0.2),
    ]);
    expect(planTransitionWindows(clips, installed)).toEqual([
      { id: 'a', kind: PUSH, leadId: 'a', trailId: 'b', from: 114, frames: 21 },
    ]);
  });

  it('opens none when the pack is not installed — the clips keep their crossfade ramps', () => {
    expect(planTransitionWindows(pushPair(), () => false)).toEqual([]);
  });

  it('leaves the native kinds to the engine even if a component claims the id', () => {
    for (const kind of ['crossfade', 'dip-to-black']) {
      const clips = serialized([video('a', 0, 5, { transitionOut: { kind, duration: 1 } }), video('b', 4, 10)]);
      expect(planTransitionWindows(clips, () => true)).toEqual([]);
    }
  });

  it('opens none with no handles at all (the serializer made it a hard cut)', () => {
    const clips = serialized([
      video('a', 0, 36, { transitionOut: { kind: PUSH, duration: 1 } }), // 36 + 4 = source end
      video('b', 4, 0),
    ]);
    expect(planTransitionWindows(clips, installed)).toEqual([]);
  });

  it('opens none between clips with no picture', () => {
    const audio = (id: string, timelineStart: number, extra: Partial<StudioClip> = {}): StudioClip => ({
      id,
      kind: 'audio',
      assetId: 'music',
      timelineStart,
      duration: 4,
      sourceIn: 10,
      ...extra,
    });
    const clips = serialized([audio('a', 0, { transitionOut: { kind: PUSH, duration: 1 } }), audio('b', 4)]);
    expect(clips[0].transitionOut?.frames).toBe(30); // the overlap is there for the SOUND…
    expect(planTransitionWindows(clips, installed)).toEqual([]); // …with nothing to paint over it
  });

  it('does not pair a clip with a neighbour that is not its partner', () => {
    const [a, b] = pushPair();
    // The serializer drops clips it can't render, so array neighbours can be strangers.
    const stranger: SerializedClip = { ...b, id: 'c', from: 400, transitionIn: { kind: PUSH, frames: 30 } };
    expect(planTransitionWindows([a, stranger], installed)).toEqual([]);
    expect(planTransitionWindows([a, { ...b, transitionIn: undefined }], installed)).toEqual([]);
  });

  it('chains: a clip with a transition at both ends sits under two windows', () => {
    const clips = serialized([
      video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }),
      video('b', 4, 10, { transitionOut: { kind: PUSH, duration: 1 } }),
      video('c', 8, 20),
    ]);
    const windows = planTransitionWindows(clips, installed);
    expect(windows.map((w) => [w.leadId, w.trailId, w.from, w.frames])).toEqual([
      ['a', 'b', 105, 30],
      ['b', 'c', 225, 30],
    ]);
    expect(coverByClip(windows).get('b')).toEqual({ head: 30, tail: 30 });
  });
});

describe('cover', () => {
  const [a, b] = serialized([video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }), video('b', 4, 10)]);
  const covers = coverByClip(planTransitionWindows([a, b], installed));

  it('hides the leading clip for its last frames and the trailing clip for its first', () => {
    expect(covers.get('a')).toEqual({ head: 0, tail: 30 });
    expect(covers.get('b')).toEqual({ head: 30, tail: 0 });
  });

  it('covers exactly the window — clip-relative, no frame shown twice and none dropped', () => {
    const lead = covers.get('a');
    expect(isCovered(lead, 104, a.durationInFrames)).toBe(false); // comp frame 104: the clip's own picture
    expect(isCovered(lead, 105, a.durationInFrames)).toBe(true); // comp frame 105: the window opens
    const trail = covers.get('b');
    expect(isCovered(trail, 29, b.durationInFrames)).toBe(true); // comp frame 134: window's last frame
    expect(isCovered(trail, 30, b.durationInFrames)).toBe(false); // comp frame 135: handed back
    expect(isCovered(undefined, 0, 100)).toBe(false);
  });
});

describe('clipVolumeAt through a pack transition', () => {
  const [a, b] = serialized([video('a', 0, 5, { transitionOut: { kind: PUSH, duration: 1 } }), video('b', 4, 10)]);

  it('is the crossfade curve: equal power, flat summed energy across the overlap', () => {
    // Mid-overlap is comp frame 120: frame 120 of `a`, frame 15 of `b`.
    const out = clipVolumeAt(a, 120);
    const into = clipVolumeAt(b, 15);
    expect(out).toBeCloseTo(Math.cos(Math.PI / 4), 6);
    expect(into).toBeCloseTo(Math.sin(Math.PI / 4), 6);
    expect(out * out + into * into).toBeCloseTo(1, 6);
    expect(clipVolumeAt(a, 104)).toBe(1); // untouched before the window
    expect(clipVolumeAt(b, 30)).toBe(1); // and after it
  });

  it('matches a crossfade frame for frame', () => {
    const [ca, cb] = serialized([video('a', 0, 5, { transitionOut: { kind: 'crossfade', duration: 1 } }), video('b', 4, 10)]);
    for (let f = 100; f < 135; f++) expect(clipVolumeAt(a, f)).toBe(clipVolumeAt(ca, f));
    for (let f = 0; f < 35; f++) expect(clipVolumeAt(b, f)).toBe(clipVolumeAt(cb, f));
  });
});
