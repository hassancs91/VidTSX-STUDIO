// The frame-purity measurement (P2 part 3, the `purity_check` look): is every
// frame a pure function of its frame number? Remotion renders an export in
// parallel tabs that each start wherever they are sent, and a still is one
// frame in a fresh page; the preview plays frames in order in one page. A piece
// whose frame N depends on what the page rendered before (a physics world
// stepped once per render, a counter in a ref, a camera prop that changed) or
// on the clock (Math.random, Date.now) draws a different frame N in each.
//
// So each sample frame is rendered twice: IN ORDER (one page, frames 0..N, as
// the preview plays) and ALONE (a fresh page that renders only N, last sample
// first). A pure piece gives identical pixels: P2 part 2 measured re-renders on
// one backend at exactly 0 difference, 3D with N8AO and shadows included.
//
// Pure: works on BGRA bitmaps, like loop-seam.ts, whose diff functions it uses.

import { changedRegion, meanAbsDiff, type Bitmap, type ChangedRegion } from './loop-seam';

/**
 * A pair differs when any pixel moves visibly (a channel by more than 24, the
 * loop seam's rule) or the mean moves at least this much (0-255): a pure piece
 * re-renders at exactly 0, so anything above it is the piece, not the renderer.
 */
export const PURITY_MIN_DIFF = 0.01;
/** Sample frames per check, at most. */
export const PURITY_MAX_FRAMES = 4;
/** Both passes render at this long side (px): enough to see a body move, cheap enough to render every frame up to the last sample. */
export const PURITY_MAX_SIDE = 540;

/** Default samples: a third of the way, two thirds, and the last frame (where drift has had longest to grow). */
export function purityFrames(durationInFrames: number): number[] {
  const last = Math.max(0, durationInFrames - 1);
  return [...new Set([Math.round(last / 3), Math.round((2 * last) / 3), last])].sort((a, b) => a - b);
}

export interface PurityPair {
  frame: number;
  /** Rendered in one page after frames 0..frame-1. */
  inOrder: Bitmap;
  /** Rendered alone in a fresh page. */
  alone: Bitmap;
}

export interface PurityFrame {
  frame: number;
  /** Mean absolute difference, 0-255. */
  mean: number;
  region: ChangedRegion | null;
  differs: boolean;
}

export interface PurityMeasure {
  frames: PurityFrame[];
  pure: boolean;
}

export function measurePurity(pairs: PurityPair[]): PurityMeasure {
  const frames = pairs.map(({ frame, inOrder, alone }) => {
    const mean = meanAbsDiff(inOrder, alone);
    const region = changedRegion(inOrder, alone);
    return { frame, mean, region, differs: region !== null || mean >= PURITY_MIN_DIFF };
  });
  return { frames, pure: frames.every((f) => !f.differs) };
}

/** The tool's answer: the verdict, each frame's numbers, where it differs, and the usual causes. */
export function describePurity(m: PurityMeasure, scale: number): string {
  const toBuild = (v: number) => Math.round(v / scale);
  const lines = [
    m.pure
      ? `PURE: frames ${m.frames.map((f) => f.frame).join(', ')} render the same in order in one page and alone in a fresh page. Every frame is a function of its frame number.`
      : 'IMPURE: a frame renders differently alone in a fresh page (a still, an export tab) than in order in one page (the preview). The export will not match what you looked at.',
  ];
  for (const f of m.frames) {
    const where = f.region
      ? `; differs in the box x ${toBuild(f.region.x)}-${toBuild(f.region.x + f.region.width - 1)}, y ${toBuild(f.region.y)}-${toBuild(f.region.y + f.region.height - 1)} (${(f.region.share * 100).toFixed(2)}% of the pixels)`
      : '';
    lines.push(`Frame ${f.frame}: mean difference ${f.mean.toFixed(3)} (0-255)${where}.`);
  }
  if (!m.pure) {
    lines.push(
      'Usual causes: a simulation stepped per render instead of through useSimulation from @vidtsx/sim; state kept between frames (a module variable, a ref, useState); Math.random, Date.now or performance.now; a Canvas camera prop that changes. Make the frame a pure function of useCurrentFrame(), then run purity_check again.',
    );
  }
  return lines.join('\n');
}
