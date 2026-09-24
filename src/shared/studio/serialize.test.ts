import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioProject } from '../types/studio';
import { serializeTimeline, type SerializedClip } from './serialize';

const FPS = 30;

function project(clips: StudioClip[], assetDuration = 40): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1280, height: 720, fps: FPS, agent: {} },
    assets: [
      {
        id: 'x',
        kind: 'video',
        path: 'C:/x.mp4',
        probe: { duration: assetDuration, hasAudio: true },
      },
    ],
    timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }] },
    proposals: [],
    shots: [],
  };
}

function serialized(clips: StudioClip[], assetDuration?: number): SerializedClip[] {
  return serializeTimeline(project(clips, assetDuration), () => 'http://x/asset').tracks[0].clips;
}

function pair(transition?: StudioClip['transitionOut']): StudioClip[] {
  return [
    {
      id: 'a',
      kind: 'video',
      assetId: 'x',
      timelineStart: 0,
      duration: 4,
      sourceIn: 0,
      ...(transition ? { transitionOut: transition } : {}),
    },
    { id: 'b', kind: 'video', assetId: 'x', timelineStart: 4, duration: 4, sourceIn: 10 },
  ];
}

describe('serializeTimeline crossfade geometry', () => {
  it('extends both clips by half the window and shifts trimBefore', () => {
    const [a, b] = serialized(pair({ kind: 'crossfade', duration: 1 }));
    // 15 frames each side of the cut at frame 120 → 30-frame overlap.
    expect(a).toMatchObject({
      from: 0,
      durationInFrames: 135,
      transitionOut: { kind: 'crossfade', frames: 30 },
    });
    expect(b).toMatchObject({
      from: 105,
      durationInFrames: 135,
      trimBefore: 285,
      transitionIn: { kind: 'crossfade', frames: 30 },
    });
  });

  it('clamps each side to its source handles (asymmetric window)', () => {
    const clips = pair({ kind: 'crossfade', duration: 1 });
    clips[1].sourceIn = 0.2; // only 6 frames of head handle on the trailing clip
    const [a, b] = serialized(clips);
    expect(a.durationInFrames).toBe(135); // leading side unaffected
    expect(b.from).toBe(114); // 120 − 6
    expect(b.durationInFrames).toBe(126);
    expect(b.trimBefore).toBeUndefined(); // 6 − 6 = 0 → key dropped
    expect(a.transitionOut?.frames).toBe(21); // 15 + 6
    expect(b.transitionIn?.frames).toBe(21);
  });

  it('degrades to a hard cut when neither side has handles', () => {
    const clips = pair({ kind: 'crossfade', duration: 1 });
    clips[0].sourceIn = 36; // 36 + 4 = 40 = source end → no tail handle
    clips[1].sourceIn = 0; // no head handle
    const [a, b] = serialized(clips);
    expect(a.transitionOut).toBeUndefined();
    expect(b.transitionIn).toBeUndefined();
    expect(a.durationInFrames).toBe(120);
    expect(b.from).toBe(120);
  });

  it('scales handle consumption by playbackRate on the trailing clip', () => {
    const clips = pair({ kind: 'crossfade', duration: 1 });
    clips[1].speed = 2;
    clips[1].duration = 2; // same material at 2×
    const [, b] = serialized(clips);
    expect(b.from).toBe(105);
    // trimBefore 300 − 15 frames × rate 2 = 270.
    expect(b.trimBefore).toBe(270);
  });

  it('ignores a stale transition on a non-contiguous boundary', () => {
    const clips = pair({ kind: 'crossfade', duration: 1 });
    clips[1] = { ...clips[1], timelineStart: 5 }; // gap — e.g. hand-edited doc
    const [a, b] = serialized(clips);
    expect(a.transitionOut).toBeUndefined();
    expect(b.transitionIn).toBeUndefined();
  });
});

describe('serializeTimeline dip-to-black', () => {
  it('adds ramps without touching geometry', () => {
    const [a, b] = serialized(pair({ kind: 'dip-to-black', duration: 1 }));
    expect(a).toMatchObject({
      from: 0,
      durationInFrames: 120,
      transitionOut: { kind: 'dip-to-black', frames: 15 },
    });
    expect(b).toMatchObject({
      from: 120,
      durationInFrames: 120,
      trimBefore: 300,
      transitionIn: { kind: 'dip-to-black', frames: 15 },
    });
  });
});

describe('serializeTimeline effects (per-clip filters)', () => {
  it('copies live entries through on video and image clips and drops disabled ones', () => {
    const clips = serialized([
      {
        id: 'a', kind: 'video', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0,
        effects: [
          { kind: 'core/noir' },
          { kind: 'core/vhs', params: { intensity: 0.5 }, disabled: true },
          { kind: 'core/cinematic-bloom', params: { warmth: 0.8 } },
        ],
      },
      { id: 'b', kind: 'video', assetId: 'x', timelineStart: 4, duration: 4, sourceIn: 10, effects: [{ kind: 'core/noir', disabled: true }] },
      { id: 'c', kind: 'video', assetId: 'x', timelineStart: 8, duration: 4, sourceIn: 20 },
      { id: 'i', kind: 'image', assetId: 'x', timelineStart: 12, duration: 2, effects: [{ kind: 'core/noir' }] },
    ]);
    expect(clips[0].effects).toEqual([{ kind: 'core/noir' }, { kind: 'core/cinematic-bloom', params: { warmth: 0.8 } }]);
    // Every entry disabled = no key at all, like a clip that never had one.
    expect(clips[1].effects).toBeUndefined();
    expect(clips[2].effects).toBeUndefined();
    expect(clips[3].effects).toEqual([{ kind: 'core/noir' }]);
  });

  it('never carries effects on a clip without a raster source', () => {
    const clips = serialized([
      { id: 's', kind: 'audio', assetId: 'x', timelineStart: 0, duration: 4, sourceIn: 0, effects: [{ kind: 'core/noir' }] },
    ]);
    expect(clips[0].kind).toBe('audio');
    expect(clips[0].effects).toBeUndefined();
  });
});
