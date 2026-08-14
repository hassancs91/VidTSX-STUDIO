import { describe, it, expect } from 'vitest';
import type { StudioClip, StudioProject, StudioShot } from '../types/studio';
import { serializeTimeline } from './serialize';

const FPS = 30;

function readyShot(id: string, overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id,
    name: id,
    kind: 'overlay',
    createdAt: '',
    activeVersion: 1,
    status: 'ready',
    ...overrides,
  };
}

function tsxClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return {
    id: 't1',
    kind: 'tsx',
    timelineStart: 2,
    duration: 4,
    sourceIn: 0,
    tsx: { shotId: 'shot-a', mode: 'overlay' },
    ...overrides,
  };
}

function project(clips: StudioClip[], shots: StudioShot[]): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    createdAt: '',
    updatedAt: '',
    settings: { width: 1280, height: 720, fps: FPS, agent: {} },
    assets: [
      { id: 'x', kind: 'video', path: 'C:/x.mp4', probe: { duration: 40, hasAudio: true } },
    ],
    timeline: { tracks: [{ id: 'o1', kind: 'overlay', name: 'FX1', clips }] },
    proposals: [],
    shots,
  };
}

function serialize(clips: StudioClip[], shots: StudioShot[]) {
  return serializeTimeline(project(clips, shots), () => 'http://x/asset').tracks[0].clips;
}

describe('serializeTimeline tsx clips', () => {
  it('emits the shot reference and frame geometry for a ready shot', () => {
    const [clip] = serialize([tsxClip()], [readyShot('shot-a')]);
    expect(clip).toMatchObject({
      kind: 'tsx',
      from: 60,
      durationInFrames: 120,
      tsx: { shotId: 'shot-a', mode: 'overlay' },
    });
    expect(clip.trimBefore).toBeUndefined(); // sourceIn 0 → no offset
    expect(clip.src).toBeUndefined();
  });

  it('serializes an advanced sourceIn (post-split right half) as trimBefore', () => {
    const [clip] = serialize([tsxClip({ sourceIn: 2 })], [readyShot('shot-a')]);
    expect(clip.trimBefore).toBe(60);
  });

  it('drops tsx clips whose shot is missing from the registry', () => {
    expect(serialize([tsxClip()], [])).toEqual([]);
  });

  it('drops tsx clips whose shot is not ready, keeping the rest playable', () => {
    const other = tsxClip({ id: 't2', timelineStart: 8, tsx: { shotId: 'shot-b', mode: 'overlay' } });
    const clips = serialize(
      [tsxClip(), other],
      [readyShot('shot-a', { status: 'error' }), readyShot('shot-b')],
    );
    expect(clips.map((c) => c.id)).toEqual(['t2']);
  });

  it('drops tsx clips that carry no shot reference at all', () => {
    expect(serialize([tsxClip({ tsx: undefined })], [readyShot('shot-a')])).toEqual([]);
  });

  it('goes NEGATIVE on trimBefore for a crossfade-in so the shot stays content-aligned', () => {
    // Video leads, shot trails; contiguous boundary at t=2 with a 1 s crossfade.
    const lead: StudioClip = {
      id: 'v',
      kind: 'video',
      assetId: 'x',
      timelineStart: 0,
      duration: 2,
      sourceIn: 0,
      transitionOut: { kind: 'crossfade', duration: 1 },
    };
    const [, shotClip] = serialize([lead, tsxClip()], [readyShot('shot-a')]);
    // 15 frames of head extension; the shot's frame 0 must stay at frame 60.
    expect(shotClip).toMatchObject({
      id: 't1',
      from: 45,
      durationInFrames: 135,
      trimBefore: -15,
      transitionIn: { kind: 'crossfade', frames: 30 },
    });
  });
});

describe('serializeTimeline tsx asset refs (D12)', () => {
  const resolver = (assetId: string) =>
    assetId === 'x' ? 'http://env/asset-x' : assetId === 'y' ? 'http://env/asset-y' : null;

  function serializeWith(clips: StudioClip[], shots: StudioShot[]) {
    return serializeTimeline(project(clips, shots), resolver).tracks[0].clips;
  }

  it('resolves assetRefs through the SAME resolver as clip src into tsx.props.assets', () => {
    const [clip] = serializeWith(
      [tsxClip()],
      [readyShot('shot-a', { assetRefs: { logo: 'x', demo: 'y' } })],
    );
    expect(clip.tsx?.props).toEqual({
      assets: { logo: 'http://env/asset-x', demo: 'http://env/asset-y' },
    });
  });

  it('emits no props for a shot without assetRefs', () => {
    const [clip] = serializeWith([tsxClip()], [readyShot('shot-a')]);
    expect(clip.tsx?.props).toBeUndefined();
  });

  it('emits no props for empty assetRefs', () => {
    const [clip] = serializeWith([tsxClip()], [readyShot('shot-a', { assetRefs: {} })]);
    expect(clip.tsx?.props).toBeUndefined();
  });

  it('drops the clip when ANY ref is unresolvable (missing-src rule), keeping the rest', () => {
    const other = tsxClip({ id: 't2', timelineStart: 8, tsx: { shotId: 'shot-b', mode: 'overlay' } });
    const clips = serializeWith(
      [tsxClip(), other],
      [
        readyShot('shot-a', { assetRefs: { logo: 'x', gone: 'deleted-asset' } }),
        readyShot('shot-b', { assetRefs: { logo: 'x' } }),
      ],
    );
    expect(clips.map((c) => c.id)).toEqual(['t2']);
    expect(clips[0].tsx?.props).toEqual({ assets: { logo: 'http://env/asset-x' } });
  });
});
