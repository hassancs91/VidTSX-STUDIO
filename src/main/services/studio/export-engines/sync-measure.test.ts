import { describe, expect, it } from 'vitest';
import {
  SYNC_AUDIO_RATE,
  classifyProbe,
  cropScaleFilter,
  exactFrameSeek,
  layoutMask,
  locateAudio,
  matchFrame,
  rms,
  sourceFrameWindow,
  thumbSize,
  zscore,
} from './sync-measure';

/** Deterministic noise in [-0.5, 0.5] (a speech stand-in xcorr can lock onto). */
function noise(count: number, seed = 1): Float32Array {
  const out = new Float32Array(count);
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out[i] = s / 0x7fffffff - 0.5;
  }
  return out;
}

function gray(count: number, seed: number): Uint8Array {
  return Uint8Array.from(noise(count, seed), (v) => Math.round((v + 0.5) * 255));
}

describe('rms', () => {
  it('is the root mean square, and 0 for an empty window', () => {
    expect(rms(Float32Array.from([3, -4, 3, -4]))).toBeCloseTo(Math.sqrt(12.5), 6);
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe('locateAudio', () => {
  it('finds a window cut from the haystack at its exact sample lag with quality ≈ 1', () => {
    const hay = noise(SYNC_AUDIO_RATE * 3, 7);
    const lag = 4321;
    const needle = hay.slice(lag, lag + SYNC_AUDIO_RATE * 2);
    const found = locateAudio(needle, hay);
    expect(found).not.toBeNull();
    expect(found!.lag).toBeCloseTo(lag, 1);
    expect(found!.quality).toBeGreaterThan(0.999);
  });

  it('is amplitude-blind and refines a half-sample shift between the two neighbours', () => {
    const base = noise(SYNC_AUDIO_RATE * 3 + 1, 11);
    // A half-sample delay ≈ the mean of neighbours (a crude fractional delay).
    const hay = new Float32Array(base.length - 1);
    for (let i = 0; i < hay.length; i++) hay[i] = (base[i] + base[i + 1]) / 2;
    const needle = base.slice(2000, 2000 + SYNC_AUDIO_RATE).map((v) => v * 0.25);
    const found = locateAudio(needle, hay)!;
    expect(found.lag).toBeGreaterThan(1999);
    expect(found.lag).toBeLessThan(2000);
    expect(found.quality).toBeGreaterThan(0.6);
  });

  it('returns null when the needle does not fit or either side is silent', () => {
    expect(locateAudio(noise(100), noise(50))).toBeNull();
    expect(locateAudio(new Float32Array(100), noise(400))).toBeNull();
  });
});

describe('zscore / matchFrame', () => {
  it('z-scores to mean 0 and unit variance; a flat image scores zeros', () => {
    const z = zscore(Uint8Array.from([10, 20, 30, 40]));
    const mean = z.reduce((a, b) => a + b, 0) / z.length;
    const variance = z.reduce((a, b) => a + b * b, 0) / z.length;
    expect(mean).toBeCloseTo(0, 6);
    expect(variance).toBeCloseTo(1, 6);
    expect(Array.from(zscore(new Uint8Array(4).fill(9)))).toEqual([0, 0, 0, 0]);
  });

  it('picks the window frame that matches (brightness/contrast-blind), with its similarity', () => {
    const size = 48 * 27;
    const window = [gray(size, 1), gray(size, 2), gray(size, 3), gray(size, 4)];
    const frame = Uint8Array.from(window[2], (v) => Math.min(255, Math.round(v * 0.8 + 20)));
    const best = matchFrame(frame, window);
    expect(best.index).toBe(2);
    expect(best.quality).toBeGreaterThan(0.99);
    expect(matchFrame(gray(size, 99), window).quality).toBeLessThan(0.2);
  });
});

describe('layoutMask (an overlay paints over part of the camera box)', () => {
  const size = 40 * 30;
  /** The export shows the camera frame on the right half only; the left half is a fixed graphic. */
  const covered = (camera: Uint8Array, graphic: Uint8Array) => Uint8Array.from(camera, (v, i) => (i % 40 < 20 ? graphic[i] : v));
  const graphic = gray(size, 500);
  const probes = [10, 20, 30, 40].map((seed) => {
    const window = [gray(size, seed), gray(size, seed + 1), gray(size, seed + 2)];
    return { window, target: covered(window[1], graphic) };
  });

  it('keeps the pixels where every probe agrees with its pass-1 frame, and lifts the masked match', () => {
    const pairs = probes.map((p) => ({ target: p.target, best: p.window[matchFrame(p.target, p.window).index] }));
    const mask = layoutMask(pairs);
    expect(mask).not.toBeNull();
    const kept = mask!.reduce((a, b) => a + b, 0) / size;
    expect(kept).toBeGreaterThan(0.45);
    expect(kept).toBeLessThan(0.6);
    for (const p of probes) {
      expect(matchFrame(p.target, p.window).quality).toBeLessThan(0.75);
      const masked = matchFrame(p.target, p.window, mask!);
      expect(masked.index).toBe(1);
      expect(masked.quality).toBeGreaterThan(0.95);
    }
  });

  it('does not invent a match: a window without the shown frame stays far below the bar under the mask', () => {
    const pairs = probes.map((p) => ({ target: p.target, best: p.window[1] }));
    const mask = layoutMask(pairs)!;
    expect(matchFrame(probes[0].target, [gray(size, 900), gray(size, 901)], mask).quality).toBeLessThan(0.2);
  });

  it('needs at least 3 probes and a visible share of at least 25 %', () => {
    const pairs = probes.map((p) => ({ target: p.target, best: p.window[1] }));
    expect(layoutMask(pairs.slice(0, 2))).toBeNull();
    const unrelated = probes.map((p) => ({ target: p.target, best: gray(size, 777) }));
    expect(layoutMask(unrelated)).toBeNull();
  });
});

describe('frame addressing', () => {
  it('seeks half a frame before the pts so the first decoded frame is frame n', () => {
    expect(exactFrameSeek(700, 60)).toBeCloseTo(699.5 / 60, 9);
    expect(exactFrameSeek(0, 60)).toBe(0);
  });

  it('opens the camera window 0.8 s before the audio time, 96 frames, on a frame boundary', () => {
    const fps = 60000 / 1001;
    const w = sourceFrameWindow(91.758, fps);
    expect(w.first).toBe(Math.ceil((91.758 - 0.8) * fps));
    expect(w.count).toBe(96);
    expect(w.seekSec).toBeCloseTo((w.first - 0.5) / fps, 9);
    expect(sourceFrameWindow(0.3, fps).first).toBe(0);
  });
});

describe('thumbnails', () => {
  it('scales the long side to 192 with even sides', () => {
    expect(thumbSize({ width: 1050, height: 840 })).toEqual({ width: 192, height: 154 });
    expect(thumbSize({ width: 3840, height: 2160 })).toEqual({ width: 192, height: 108 });
    expect(thumbSize({ width: 2, height: 400 })).toEqual({ width: 2, height: 192 });
  });

  it('crops the rect, area-scales to the thumb and goes gray', () => {
    expect(cropScaleFilter({ x: 2790, y: 1256, width: 1050, height: 840 }, { width: 192, height: 154 })).toBe(
      'crop=1050:840:2790:1256,scale=192:154:flags=area,format=gray',
    );
  });
});

describe('classifyProbe', () => {
  const audio = { sec: 90.0, quality: 0.93 };
  const video = { sec: 90.1, quality: 0.96 };
  it('turns a confident pair into an error in ms (+ = audio behind the picture)', () => {
    expect(classifyProbe({ windowRms: 0.05, audio, video })).toEqual({ status: 'ok', errorMs: 100 });
  });
  it('names why a probe is not confident', () => {
    expect(classifyProbe({ windowRms: 0.001, audio, video }).status).toBe('silent');
    expect(classifyProbe({ windowRms: 0.05, audio: null, video }).status).toBe('low-audio');
    expect(classifyProbe({ windowRms: 0.05, audio: { sec: 90, quality: 0.4 }, video }).status).toBe('low-audio');
    expect(classifyProbe({ windowRms: 0.05, audio, video: { sec: 90, quality: 0.85 } }).status).toBe('low-video');
    expect(classifyProbe({ windowRms: 0.05, audio, video: { sec: 90, quality: 0.85 } }, { minMatch: 0.85 }).status).toBe('ok');
  });
});
