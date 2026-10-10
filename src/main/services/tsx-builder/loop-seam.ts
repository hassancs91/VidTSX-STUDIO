// The loop-seam measurement (TSX_BUILDER_DESIGN.md T2 `loop_seam`): does the
// last frame flow into frame 0? A still cannot show a jump; numbers can. The
// step last → 0 is compared with the steps around it (last-1 → last and
// 0 → 1): in a seamless loop the wrap is just another step.
//
// Pure: works on BGRA bitmaps (nativeImage.toBitmap()), no new dependency.
// Measure rendered PNGs, never a video: in an H.264 file frame 0 is a
// keyframe, and its codec noise alone reads as a wrap step (R0 measured a
// "jump" of 0.26 on B2's MP4 whose rendered frames 239 and 0 are identical).
//
// Thresholds, from the P1 part 4 fixture run on rendered frames: R0-B1 (a
// real jump) wrap 0.72 vs neighbours 0.05 = 14×; the seamless loops 0.76×
// (R0-B3), 0.89× (P0-B2), 0.95× (F2), 1.51× (R0-B4), 0 (R0-B2).

export interface Bitmap {
  width: number;
  height: number;
  /** BGRA, 4 bytes per pixel. */
  data: Uint8Array;
}

/** The wrap is a jump when it is this many times the neighbours' mean... */
export const SEAM_JUMP_RATIO = 2.5;
/**
 * ...and at least this big (0-255): below it is anti-aliasing, not a step.
 * Low on purpose: a 25 px label popping in during a still hold is ~0.04.
 */
export const SEAM_MIN_DIFF = 0.03;
/** A pixel counts as changed when a channel moves more than this. */
const CHANGED = 24;

function assertSameSize(a: Bitmap, b: Bitmap): void {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) {
    throw new Error(`Frames differ in size: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

/** Mean absolute difference over the R, G and B channels, 0-255. */
export function meanAbsDiff(a: Bitmap, b: Bitmap): number {
  assertSameSize(a, b);
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
  }
  return sum / ((a.data.length / 4) * 3);
}

export interface ChangedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Changed pixels as a share of the frame, 0-1. */
  share: number;
}

/** The box around the pixels that changed visibly; null when none did. */
export function changedRegion(a: Bitmap, b: Bitmap): ChangedRegion | null {
  assertSameSize(a, b);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (
        Math.abs(a.data[i] - b.data[i]) > CHANGED ||
        Math.abs(a.data[i + 1] - b.data[i + 1]) > CHANGED ||
        Math.abs(a.data[i + 2] - b.data[i + 2]) > CHANGED
      ) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count === 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, share: count / (a.width * a.height) };
}

export interface SeamFrames {
  beforeLast: Bitmap;
  last: Bitmap;
  first: Bitmap;
  afterFirst: Bitmap;
}

export interface SeamMeasure {
  /** last → 0. */
  wrap: number;
  /** last-1 → last. */
  before: number;
  /** 0 → 1. */
  after: number;
  /** Mean of `before` and `after`. */
  neighbours: number;
  /** wrap / neighbours (Infinity when the neighbours are still and the wrap is not). */
  ratio: number;
  jump: boolean;
  /** Where last → 0 changes, in build pixels. */
  region: ChangedRegion | null;
}

export function measureSeam(frames: SeamFrames): SeamMeasure {
  const wrap = meanAbsDiff(frames.last, frames.first);
  const before = meanAbsDiff(frames.beforeLast, frames.last);
  const after = meanAbsDiff(frames.first, frames.afterFirst);
  const neighbours = (before + after) / 2;
  const ratio = neighbours > 0 ? wrap / neighbours : wrap > 0 ? Infinity : 1;
  const jump = wrap >= SEAM_MIN_DIFF && ratio >= SEAM_JUMP_RATIO;
  return { wrap, before, after, neighbours, ratio, jump, region: changedRegion(frames.last, frames.first) };
}

const n2 = (v: number) => v.toFixed(2);

/** The tool's answer: the numbers, the verdict, and where to look. */
export function describeSeam(m: SeamMeasure, last: number): string {
  const lines = [
    `Mean pixel difference (0-255): wrap ${last} → 0 = ${n2(m.wrap)}; neighbours ${last - 1} → ${last} = ${n2(m.before)}, 0 → 1 = ${n2(m.after)} (mean ${n2(m.neighbours)}); ratio ${Number.isFinite(m.ratio) ? n2(m.ratio) : '∞'}.`,
  ];
  if (m.jump) {
    lines.push(
      `JUMP: the wrap is ${Number.isFinite(m.ratio) ? `${n2(m.ratio)}×` : 'far above'} an ordinary step. The last frame does not flow into frame 0.`,
    );
  } else {
    lines.push(
      m.wrap < SEAM_MIN_DIFF
        ? 'OK: the wrap is too small to see.'
        : `OK: the wrap is an ordinary step (under ${SEAM_JUMP_RATIO}× its neighbours).`,
    );
  }
  if (m.region) {
    const r = m.region;
    lines.push(
      `What changes from frame ${last} to frame 0: the box x ${r.x}-${r.x + r.width - 1}, y ${r.y}-${r.y + r.height - 1} (${(r.share * 100).toFixed(1)}% of the pixels).`,
    );
  }
  return lines.join('\n');
}
