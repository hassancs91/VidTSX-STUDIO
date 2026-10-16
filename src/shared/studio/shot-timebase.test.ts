import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Thumbnail } from '@remotion/player';
import type { StudioClip, StudioProject, StudioShot } from '../types/studio';
import { serializeTimeline } from './serialize';
import { shotBoxLayout, shotFrameAt, shotTimebaseFor } from './shot-timebase';
import { TimelineComposition } from './TimelineComposition';

const SHOT_1080P30 = { fps: 30, width: 1920, height: 1080, durationInFrames: 333 };
const PROJECT_4K60 = { fps: 60, width: 3840, height: 2160 };

describe('shotTimebaseFor', () => {
  it('gives a 1080p30 shot its own timebase in a 4K60 project', () => {
    expect(shotTimebaseFor(SHOT_1080P30, PROJECT_4K60)).toEqual(SHOT_1080P30);
  });

  it('gives none to a shot that matches the project (every generated shot)', () => {
    expect(shotTimebaseFor({ ...SHOT_1080P30, fps: 60, width: 3840, height: 2160 }, PROJECT_4K60)).toBeUndefined();
  });

  it('gives one for a size-only or an fps-only mismatch', () => {
    expect(shotTimebaseFor({ ...SHOT_1080P30, fps: 60 }, PROJECT_4K60)?.width).toBe(1920);
    expect(shotTimebaseFor(SHOT_1080P30, { fps: 60, width: 1920, height: 1080 })?.fps).toBe(30);
  });

  it('gives none without a config, or with an unusable one', () => {
    expect(shotTimebaseFor(undefined, PROJECT_4K60)).toBeUndefined();
    expect(shotTimebaseFor({ ...SHOT_1080P30, fps: 0 }, PROJECT_4K60)).toBeUndefined();
    expect(shotTimebaseFor({ ...SHOT_1080P30, durationInFrames: Number.NaN }, PROJECT_4K60)).toBeUndefined();
  });
});

describe('shotFrameAt', () => {
  it('shows each 30 fps frame for exactly two 60 fps frames', () => {
    expect([0, 1, 2, 3, 4, 5].map((f) => shotFrameAt(f, 60, 30))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(shotFrameAt(665, 60, 30)).toBe(332);
  });

  it('lands shot frame k on k / shotFps seconds', () => {
    // A cue at shot frame 59 (1.9667 s) shows first at composition frame 118 (1.9667 s).
    expect(shotFrameAt(117, 60, 30)).toBe(58);
    expect(shotFrameAt(118, 60, 30)).toBe(59);
  });

  it('is the identity when the rates match, and holds for non-integer ratios', () => {
    expect(shotFrameAt(1234, 30, 30)).toBe(1234);
    expect(shotFrameAt(25, 25, 30)).toBe(30);
    expect(shotFrameAt(5, 50, 30)).toBe(3);
  });
});

describe('shotBoxLayout', () => {
  it('scales a 1920×1080 shot by 2 at the origin of a 3840×2160 frame', () => {
    expect(shotBoxLayout(SHOT_1080P30, 3840, 2160)).toEqual({ scale: 2, left: 0, top: 0 });
  });

  it('fits and centres a shot of another aspect', () => {
    expect(shotBoxLayout({ width: 1080, height: 1920 }, 1920, 1080)).toEqual({ scale: 0.5625, left: 656.25, top: 0 });
  });
});

function shotClip(overrides: Partial<StudioClip> = {}): StudioClip {
  return { id: 'c1', kind: 'tsx', timelineStart: 1, duration: 11.1, sourceIn: 0, tsx: { shotId: 's', mode: 'overlay' }, ...overrides };
}

function project(shot: StudioShot, clip: StudioClip = shotClip()): StudioProject {
  return {
    schemaVersion: 1,
    id: 'p',
    name: 'p',
    createdAt: '',
    updatedAt: '',
    settings: { ...PROJECT_4K60, agent: {} },
    assets: [],
    timeline: { tracks: [{ id: 'o', kind: 'overlay', name: 'Shots', clips: [clip] }] },
    proposals: [],
    shots: [shot],
  };
}

const shot = (config?: StudioShot['config']): StudioShot => ({
  id: 's', name: 's', kind: 'cutaway', createdAt: '', activeVersion: 1, status: 'ready', ...(config ? { config } : {}),
});

describe('serializeTimeline shot timebase', () => {
  it('carries the shot config when it differs from the project', () => {
    const [clip] = serializeTimeline(project(shot(SHOT_1080P30)), () => null).tracks[0].clips;
    expect(clip.tsx?.timebase).toEqual(SHOT_1080P30);
    expect(clip).toMatchObject({ from: 60, durationInFrames: 666 });
  });

  it('carries nothing for a matching shot or a shot without a config', () => {
    const matching = { ...SHOT_1080P30, ...PROJECT_4K60 };
    expect(serializeTimeline(project(shot(matching)), () => null).tracks[0].clips[0].tsx?.timebase).toBeUndefined();
    expect(serializeTimeline(project(shot()), () => null).tracks[0].clips[0].tsx?.timebase).toBeUndefined();
  });
});

/** Prints what a shot sees: its frame, its config, and an inner Sequence's frame. */
function Probe() {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return createElement(
    'i',
    { 'data-probe': `${frame}|${fps}|${width}x${height}|${durationInFrames}` },
    createElement(Sequence, { from: 30, layout: 'none', children: createElement(Inner) }),
  );
}

function Inner() {
  return createElement('b', { 'data-inner': String(useCurrentFrame()) });
}

/** Render the whole composition at one frame and read the probe back. */
function probeAt(frameToDisplay: number, config: StudioShot['config'], clip?: StudioClip) {
  const timeline = serializeTimeline(project(shot(config), clip), () => null);
  const html = renderToStaticMarkup(
    // The Player's generic props want a Record; the composition's props are an interface.
    createElement(Thumbnail as unknown as React.FC<Record<string, unknown>>, {
      component: TimelineComposition,
      inputProps: { timeline, components: { s: Probe } },
      compositionWidth: timeline.width,
      compositionHeight: timeline.height,
      durationInFrames: timeline.durationInFrames,
      fps: timeline.fps,
      frameToDisplay,
    }),
  );
  return {
    probe: /data-probe="([^"]*)"/.exec(html)?.[1],
    inner: /data-inner="([^"]*)"/.exec(html)?.[1],
    scaled: html.includes('scale(2)'),
  };
}

describe('ShotTimebase in the composition', () => {
  it('runs a 1080p30 shot on its own clock and config inside a 4K60 project', () => {
    // The clip starts at 1 s = composition frame 60. Composition frame 60 + 2·100 = shot frame 100.
    const { probe, inner, scaled } = probeAt(260, SHOT_1080P30);
    expect(probe).toBe('100|30|1920x1080|333');
    expect(inner).toBe('70'); // the shot's own <Sequence from={30}> counts on the shot's clock
    expect(scaled).toBe(true);
    expect(probeAt(261, SHOT_1080P30).probe).toBe('100|30|1920x1080|333');
    expect(probeAt(262, SHOT_1080P30).probe).toBe('101|30|1920x1080|333');
  });

  it('continues the shot clock across a split (trim offset in composition frames)', () => {
    // Right half of a split at 3 s: sourceIn 2 s into the shot → trimBefore 120 composition frames.
    const right = shotClip({ id: 'c2', timelineStart: 3, duration: 9.1, sourceIn: 2 });
    expect(probeAt(180, SHOT_1080P30, right).probe).toBe('60|30|1920x1080|333');
  });

  it('leaves a matching shot on the composition clock, unscaled', () => {
    const { probe, scaled } = probeAt(260, { ...SHOT_1080P30, ...PROJECT_4K60, durationInFrames: 666 });
    expect(probe).toBe('200|60|3840x2160|666');
    expect(scaled).toBe(false);
  });
});
