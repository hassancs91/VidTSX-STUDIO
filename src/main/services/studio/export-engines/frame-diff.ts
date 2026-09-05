/**
 * The T1 pixel-diff instrument in product form (docs/export-engines-plan.md
 * D5; the numbers match scripts/bench/t1-diff.mjs): frames pulled by INDEX
 * from two 30 fps CFR files, per-channel mean absolute difference, the share
 * of pixels whose max-channel delta exceeds 8 and 24, the max delta, and a
 * side-by-side still (a | b | amplified diff). Pure maths here is unit-tested;
 * ffmpeg does the decoding (rawvideo rgb24 over stdout — no image library in
 * the main process).
 */
import fs from 'fs/promises';
import { runFfmpeg } from '../ffmpeg-bin';

export interface FrameDiffRow {
  frame: number;
  meanAbsDiff: [number, number, number];
  meanA: [number, number, number];
  meanB: [number, number, number];
  pctOver8: number;
  pctOver24: number;
  maxDelta: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure: compare two rgb24 buffers of `pixels` pixels; also fills `diffOut` (×8 amplified) when given. */
export function diffRgb24(a: Buffer, b: Buffer, pixels: number, diffOut?: Buffer): Omit<FrameDiffRow, 'frame'> {
  if (a.length < pixels * 3 || b.length < pixels * 3) {
    throw new Error(`frame buffers too short: ${a.length} / ${b.length} bytes for ${pixels} pixels`);
  }
  const sum = [0, 0, 0];
  const sumA = [0, 0, 0];
  const sumB = [0, 0, 0];
  let over8 = 0;
  let over24 = 0;
  let maxDelta = 0;
  for (let i = 0; i < pixels; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) {
      const va = a[i * 3 + c];
      const vb = b[i * 3 + c];
      const d = Math.abs(va - vb);
      sum[c] += d;
      sumA[c] += va;
      sumB[c] += vb;
      if (d > m) m = d;
      if (diffOut) diffOut[i * 3 + c] = Math.min(255, d * 8);
    }
    if (m > 8) over8++;
    if (m > 24) over24++;
    if (m > maxDelta) maxDelta = m;
  }
  const per = (s: number[]): [number, number, number] => [round2(s[0] / pixels), round2(s[1] / pixels), round2(s[2] / pixels)];
  return {
    meanAbsDiff: per(sum),
    meanA: [Math.round(sumA[0] / pixels), Math.round(sumA[1] / pixels), Math.round(sumA[2] / pixels)],
    meanB: [Math.round(sumB[0] / pixels), Math.round(sumB[1] / pixels), Math.round(sumB[2] / pixels)],
    pctOver8: round2((over8 / pixels) * 100),
    pctOver24: round2((over24 / pixels) * 100),
    maxDelta,
  };
}

/**
 * Pure: which frames to sample. T1's set for a 900-frame single-cut
 * timeline (1, 300, 449, 450, 451, 600, 899) falls out of it: the first and
 * last frame, the thirds, and one frame either side of every cut.
 */
export function sampleFrames(durationInFrames: number, cutFrames: readonly number[], cap = 24): number[] {
  const last = durationInFrames - 1;
  if (last < 1) return [0];
  const set = new Set<number>([1, Math.floor(durationInFrames / 3), Math.floor((2 * durationInFrames) / 3), last]);
  const cuts = [...new Set(cutFrames)].filter((c) => c > 0 && c < last).sort((x, y) => x - y);
  const room = Math.max(0, cap - set.size);
  const keep = cuts.length * 3 <= room ? cuts : thin(cuts, Math.floor(room / 3));
  for (const c of keep) {
    set.add(c - 1);
    set.add(c);
    set.add(c + 1);
  }
  return [...set].filter((f) => f >= 0 && f <= last).sort((x, y) => x - y);
}

function thin<T>(items: T[], n: number): T[] {
  if (n <= 0) return [];
  if (items.length <= n) return items;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[Math.floor((i * items.length) / n)]);
  return out;
}

/**
 * One frame of a CFR file as rgb24 bytes, by index. Remotion's bundled ffmpeg
 * has no `select` filter and no rawvideo muxer, so the frame is reached by an
 * accurate seek to half a frame before its pts (the first decoded frame is
 * then frame n exactly — byte-identical to `select=eq(n,N)`, checked
 * 2026-09-05) and written through image2pipe with the rawvideo encoder.
 */
export async function extractFrameRgb24(ffmpeg: string, file: string, frame: number, fps: number, signal?: AbortSignal): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const seek = Math.max(0, (frame - 0.5) / fps).toFixed(6);
  await runFfmpeg(
    ffmpeg,
    ['-v', 'error', '-nostdin', '-ss', seek, '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { signal, onStdout: (chunk) => chunks.push(chunk) },
  );
  return Buffer.concat(chunks);
}

/** Pure: nearest-neighbour downscale of an rgb24 frame by an integer factor. */
export function downscaleRgb24(src: Buffer, width: number, height: number, factor: number): { data: Buffer; width: number; height: number } {
  const w = Math.floor(width / factor);
  const h = Math.floor(height / factor);
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const sy = y * factor;
    for (let x = 0; x < w; x++) {
      const si = (sy * width + x * factor) * 3;
      const di = (y * w + x) * 3;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
    }
  }
  return { data: out, width: w, height: h };
}

/** Pure: tiles of equal size side by side with a 4 px black gutter, as one rgb24 frame. */
export function tileRgb24(tiles: ReadonlyArray<{ data: Buffer; width: number; height: number }>, gutter = 4): { data: Buffer; width: number; height: number } {
  const height = Math.max(...tiles.map((t) => t.height));
  const width = tiles.reduce((sum, t) => sum + t.width, 0) + gutter * (tiles.length - 1);
  const out = Buffer.alloc(width * height * 3);
  let x0 = 0;
  for (const tile of tiles) {
    for (let y = 0; y < tile.height; y++) {
      tile.data.copy(out, (y * width + x0) * 3, y * tile.width * 3, (y + 1) * tile.width * 3);
    }
    x0 += tile.width + gutter;
  }
  return { data: out, width, height };
}

/** a | b | amplified diff, downscaled to ≤ 640 px tiles, as one PNG (image2pipe + rawvideo decoder + png encoder — all in the bundled ffmpeg). */
export async function writeSideBySide(
  ffmpeg: string,
  frames: { a: Buffer; b: Buffer; diff: Buffer; width: number; height: number },
  outPng: string,
  signal?: AbortSignal,
): Promise<void> {
  const factor = Math.max(1, Math.ceil(frames.width / 640));
  const tiled = tileRgb24([frames.a, frames.b, frames.diff].map((f) => downscaleRgb24(f, frames.width, frames.height, factor)));
  const raw = `${outPng}.rgb`;
  await fs.writeFile(raw, tiled.data);
  try {
    await runFfmpeg(
      ffmpeg,
      ['-y', '-v', 'error', '-nostdin', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${tiled.width}x${tiled.height}`, '-i', raw, '-frames:v', '1', outPng],
      { signal },
    );
  } finally {
    await fs.rm(raw, { force: true }).catch(() => {});
  }
}
