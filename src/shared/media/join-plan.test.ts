// `planJoin` / `clipOpacity` — the join_clips timing, checked against the lab
// build it replaces (interior-staging-01: ffmpeg `fade=t=out:st=d1-0.25:d=0.25`
// on clip 1, `fade=t=in:st=0:d=0.3` on clip 2, concat, 24 fps → 386 frames).

import { describe, it, expect } from 'vitest';
import { clipOpacity, planJoin, type JoinClipSource, type JoinOptions } from './join-plan';

// The lab's two Kling 3 Pro clips as ffprobe reports them.
const STAGING: JoinClipSource = { duration: 241 / 24, width: 1080, height: 1920, fps: 24, hasAudio: false };
const GLIDE: JoinClipSource = { duration: 145 / 24, width: 1080, height: 1920, fps: 24, hasAudio: false };
const DIP: JoinOptions = { transition: 'dip-to-black', fadeOutSeconds: 0.25, fadeInSeconds: 0.3, fit: 'cover' };

describe('planJoin', () => {
  it('lays the lab clips back to back: 241 + 145 = 386 frames, the dip only at the join', () => {
    const plan = planJoin([STAGING, GLIDE], { ...DIP, width: 1080, height: 1920, fps: 24 });
    expect(plan).toMatchObject({ width: 1080, height: 1920, fps: 24, durationInFrames: 386, fit: 'cover' });
    expect(plan.clips[0]).toEqual({ from: 0, durationInFrames: 241, fadeInFrames: 0, fadeOutFrames: 6, muted: true });
    expect(plan.clips[1]).toMatchObject({ from: 241, durationInFrames: 145, fadeOutFrames: 0, muted: true });
    expect(plan.clips[1].fadeInFrames).toBeCloseTo(7.2, 10);
  });

  it('a cut has no ramps', () => {
    const plan = planJoin([STAGING, GLIDE, STAGING], { ...DIP, transition: 'cut' });
    expect(plan.clips.map((c) => [c.from, c.fadeInFrames, c.fadeOutFrames])).toEqual([[0, 0, 0], [241, 0, 0], [386, 0, 0]]);
    expect(plan.durationInFrames).toBe(627);
  });

  it('a middle clip of three dips at both ends; the first never fades in, the last never fades out', () => {
    const plan = planJoin([STAGING, GLIDE, STAGING], DIP);
    expect(plan.clips.map((c) => c.fadeOutFrames)).toEqual([6, 6, 0]);
    expect(plan.clips.map((c) => c.fadeInFrames > 0)).toEqual([false, true, true]);
  });

  it('defaults size and rate to the first clip; an explicit rate re-times every clip', () => {
    const seedance = { ...GLIDE, width: 720, height: 1280 };
    expect(planJoin([seedance, STAGING], DIP)).toMatchObject({ width: 720, height: 1280, fps: 24 });
    const at30 = planJoin([STAGING, GLIDE], { ...DIP, fps: 30 });
    expect(at30.clips.map((c) => c.durationInFrames)).toEqual([301, 181]);
    expect(at30.clips[0].fadeOutFrames).toBeCloseTo(7.5, 10);
  });

  it('rounds the size to even pixels, keeps a clip with audio unmuted, and caps a fade at the clip', () => {
    const plan = planJoin([{ ...STAGING, hasAudio: true }, { ...GLIDE, duration: 0.1 }], { ...DIP, width: 1081, height: 1919, fadeInSeconds: 2 });
    expect([plan.width, plan.height]).toEqual([1082, 1920]);
    expect(plan.clips[0].muted).toBe(false);
    expect(plan.clips[1]).toMatchObject({ durationInFrames: 2, fadeInFrames: 2 });
  });

  it('refuses nothing to join, a clip with no length, and a first clip with no rate or size', () => {
    expect(() => planJoin([], DIP)).toThrow('connect at least one video');
    expect(() => planJoin([STAGING, { ...GLIDE, duration: 0 }], DIP)).toThrow('Video 2 reports no length');
    expect(() => planJoin([{ ...STAGING, fps: 0 }], DIP)).toThrow('no frame rate');
    expect(planJoin([{ ...STAGING, fps: 0 }], { ...DIP, fps: 25 }).fps).toBe(25);
    expect(() => planJoin([{ ...STAGING, width: 0 }], DIP)).toThrow('no size');
  });
});

describe('clipOpacity', () => {
  const plan = planJoin([STAGING, GLIDE], DIP);
  const [staging, glide] = plan.clips;

  it('matches ffmpeg fade on every frame of the lab join', () => {
    // fade=t=out:st=d1-0.25:d=0.25 → (d1 - t) / 0.25; fade=t=in:st=0:d=0.3 → t / 0.3; t = f / 24.
    const d1 = STAGING.duration;
    for (let f = 0; f < staging.durationInFrames; f += 1) {
      const t = f / 24;
      expect(clipOpacity(staging, f), `staging ${f}`).toBeCloseTo(Math.min(1, Math.max(0, (d1 - t) / 0.25)), 9);
    }
    for (let f = 0; f < glide.durationInFrames; f += 1) {
      expect(clipOpacity(glide, f), `glide ${f}`).toBeCloseTo(Math.min(1, (f / 24) / 0.3), 9);
    }
  });

  it('is full until the fade-out, a sixth on the outgoing clip\'s last frame, black on the incoming clip\'s first', () => {
    expect(clipOpacity(staging, 0)).toBe(1);
    expect(clipOpacity(staging, 235)).toBe(1);
    expect(clipOpacity(staging, 238)).toBeCloseTo(0.5, 10);
    expect(clipOpacity(staging, 240)).toBeCloseTo(1 / 6, 10);
    expect(clipOpacity(glide, 0)).toBe(0);
    expect(clipOpacity(glide, 8)).toBe(1);
  });

  it('multiplies both ramps on a clip shorter than its two fades', () => {
    expect(clipOpacity({ durationInFrames: 4, fadeInFrames: 4, fadeOutFrames: 4 }, 2)).toBeCloseTo(0.25, 10);
  });
});
