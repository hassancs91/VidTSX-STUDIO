import { describe, it, expect } from 'vitest';
import type { StudioTimeline } from '@shared/types/studio';
import { findClip } from './timeline-ops';
import { detachAudio, setClipSpeed, updateClip } from './clip-update-ops';

/** V1 holds two back-to-back cuts of the same source; A1 holds a music bed. */
function makeTimeline(): StudioTimeline {
  return {
    tracks: [
      {
        id: 'v1',
        kind: 'video',
        name: 'V1',
        clips: [
          { id: 'c1', kind: 'video', assetId: 'asset1', timelineStart: 0, duration: 5, sourceIn: 0 },
          { id: 'c2', kind: 'video', assetId: 'asset1', timelineStart: 5, duration: 5, sourceIn: 20 },
        ],
      },
      {
        id: 'a1',
        kind: 'audio',
        name: 'A1',
        clips: [{ id: 'm1', kind: 'audio', assetId: 'music', timelineStart: 0, duration: 30 }],
      },
    ],
  };
}

describe('updateClip', () => {
  it('patches gain, clamped to 0–2', () => {
    const next = updateClip(makeTimeline(), 'c1', { gain: 5 });
    expect(findClip(next, 'c1')!.clip.gain).toBe(2);
    const muted = updateClip(makeTimeline(), 'c1', { gain: 0 });
    expect(findClip(muted, 'c1')!.clip.gain).toBe(0);
  });

  it('stores neutral values by removing the key (gain 1, empty label)', () => {
    const withGain = updateClip(makeTimeline(), 'c1', { gain: 0.5 });
    const back = updateClip(withGain, 'c1', { gain: 1 });
    expect('gain' in findClip(back, 'c1')!.clip).toBe(false);

    const labelled = updateClip(makeTimeline(), 'c1', { label: 'Intro' });
    expect(findClip(labelled, 'c1')!.clip.label).toBe('Intro');
    const cleared = updateClip(labelled, 'c1', { label: '   ' });
    expect('label' in findClip(cleared, 'c1')!.clip).toBe(false);
  });

  it('merges transform field-wise and drops neutral fields', () => {
    const step1 = updateClip(makeTimeline(), 'c1', { transform: { opacity: 0.5 } });
    const step2 = updateClip(step1, 'c1', { transform: { x: 100, rotation: 45 } });
    expect(findClip(step2, 'c1')!.clip.transform).toEqual({ opacity: 0.5, x: 100, rotation: 45 });
    // Resetting every field back to neutral removes the transform entirely.
    const reset = updateClip(step2, 'c1', { transform: { opacity: 1, x: 0, rotation: 0 } });
    expect('transform' in findClip(reset, 'c1')!.clip).toBe(false);
  });

  it('sets fades, clamped so fadeIn + fadeOut ≤ duration (fade-in wins)', () => {
    const faded = updateClip(makeTimeline(), 'c1', { fadeInSec: 1.5, fadeOutSec: 2 });
    const clip = findClip(faded, 'c1')!.clip;
    expect(clip.fadeInSec).toBe(1.5);
    expect(clip.fadeOutSec).toBe(2);

    // Overshoot: 4 + 3 on a 5 s clip → fadeIn keeps 4, fadeOut gets 1.
    const over = updateClip(makeTimeline(), 'c1', { fadeInSec: 4, fadeOutSec: 3 });
    const clamped = findClip(over, 'c1')!.clip;
    expect(clamped.fadeInSec).toBe(4);
    expect(clamped.fadeOutSec).toBe(1);

    // Zero removes the key.
    const cleared = updateClip(faded, 'c1', { fadeInSec: 0, fadeOutSec: 0 });
    expect('fadeInSec' in findClip(cleared, 'c1')!.clip).toBe(false);
    expect('fadeOutSec' in findClip(cleared, 'c1')!.clip).toBe(false);
  });

  it('rejects unknown clip, locked track, and no-change patches (identity)', () => {
    const timeline = makeTimeline();
    expect(updateClip(timeline, 'missing', { gain: 0.5 })).toBe(timeline);
    expect(
      updateClip(timeline, 'c1', { gain: 1, label: '', transform: { scale: 1 }, fadeInSec: 0 }),
    ).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(updateClip(locked, 'c1', { gain: 0.5 })).toBe(locked);
  });
});

describe('setClipSpeed', () => {
  it('2× halves the duration in place, timelineStart and sourceIn untouched', () => {
    const next = setClipSpeed(makeTimeline(), 'c1', 2);
    const clip = findClip(next, 'c1')!.clip;
    expect(clip.timelineStart).toBe(0);
    expect(clip.duration).toBe(2.5);
    expect(clip.sourceIn).toBe(0);
    expect(clip.speed).toBe(2);
  });

  it('slowing down clamps against the next clip like an end-trim', () => {
    // c1 at 0.5× wants 10 s but c2 starts at 5 — boxed in, duration stays 5.
    const next = setClipSpeed(makeTimeline(), 'c1', 0.5);
    const clip = findClip(next, 'c1')!.clip;
    expect(clip.duration).toBe(5);
    expect(clip.speed).toBe(0.5);
    // The last clip on the track has open space — it really lengthens.
    const tail = setClipSpeed(makeTimeline(), 'c2', 0.5);
    expect(findClip(tail, 'c2')!.clip.duration).toBe(10);
  });

  it('round-trips: back to 1× restores the original duration and drops the key', () => {
    const fast = setClipSpeed(makeTimeline(), 'c2', 4);
    expect(findClip(fast, 'c2')!.clip.duration).toBe(1.25);
    const back = setClipSpeed(fast, 'c2', 1);
    const clip = findClip(back, 'c2')!.clip;
    expect(clip.duration).toBe(5);
    expect('speed' in clip).toBe(false);
  });

  it('re-clamps fades when the clip shortens', () => {
    const faded = updateClip(makeTimeline(), 'c1', { fadeInSec: 2, fadeOutSec: 2 });
    const fast = setClipSpeed(faded, 'c1', 2); // 5 s → 2.5 s
    const clip = findClip(fast, 'c1')!.clip;
    expect(clip.fadeInSec).toBe(2);
    expect(clip.fadeOutSec).toBe(0.5);
  });

  it('rejects when the sped-up clip falls under the minimum duration', () => {
    const timeline = makeTimeline();
    timeline.tracks[0].clips[0].duration = 0.1;
    expect(setClipSpeed(timeline, 'c1', 4)).toBe(timeline);
  });

  it('rejects invalid speeds, locked tracks, and same-speed calls (identity)', () => {
    const timeline = makeTimeline();
    expect(setClipSpeed(timeline, 'c1', 0)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', -1)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', Number.NaN)).toBe(timeline);
    expect(setClipSpeed(timeline, 'c1', 1)).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(setClipSpeed(locked, 'c1', 2)).toBe(locked);
  });
});

describe('detachAudio', () => {
  it('mutes the video clip and creates a sample-aligned audio clip', () => {
    // A1 is fully occupied by the music bed, so a NEW audio track appears.
    const next = detachAudio(makeTimeline(), 'c2', 'det');
    const video = findClip(next, 'c2')!.clip;
    expect(video.gain).toBe(0);

    const detached = findClip(next, 'det')!;
    expect(detached.track.kind).toBe('audio');
    expect(detached.track.id).not.toBe('a1');
    expect(detached.clip).toMatchObject({
      kind: 'audio',
      assetId: 'asset1',
      timelineStart: 5,
      duration: 5,
      sourceIn: 20,
    });
  });

  it('uses an existing audio track when the span is free, carrying gain/speed/fades', () => {
    const timeline = makeTimeline();
    timeline.tracks[1].clips = []; // empty A1
    timeline.tracks[0].clips[0] = {
      ...timeline.tracks[0].clips[0],
      gain: 0.6,
      speed: 2,
      fadeInSec: 1,
    };
    const next = detachAudio(timeline, 'c1', 'det');
    const detached = findClip(next, 'det')!;
    expect(detached.track.id).toBe('a1');
    expect(detached.clip.gain).toBe(0.6);
    expect(detached.clip.speed).toBe(2);
    expect(detached.clip.fadeInSec).toBe(1);
    // The muted video keeps the picture but loses the (audio-only) fades.
    const video = findClip(next, 'c1')!.clip;
    expect(video.gain).toBe(0);
    expect('fadeInSec' in video).toBe(false);
  });

  it('one op = both sides, so a single undo snapshot restores everything', () => {
    const before = makeTimeline();
    const after = detachAudio(before, 'c1', 'det');
    expect(after).not.toBe(before);
    // The original object is untouched (pure op) — undo just re-points at it.
    expect(findClip(before, 'c1')!.clip.gain).toBeUndefined();
    expect(findClip(before, 'det')).toBeNull();
  });

  it('rejects non-video clips, locked tracks, already-muted clips, unknown ids', () => {
    const timeline = makeTimeline();
    expect(detachAudio(timeline, 'm1', 'det')).toBe(timeline);
    expect(detachAudio(timeline, 'missing', 'det')).toBe(timeline);
    const locked = makeTimeline();
    locked.tracks[0].locked = true;
    expect(detachAudio(locked, 'c1', 'det')).toBe(locked);
    const muted = updateClip(makeTimeline(), 'c1', { gain: 0 });
    expect(detachAudio(muted, 'c1', 'det')).toBe(muted);
  });
});
