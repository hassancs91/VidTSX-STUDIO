import { deflateSync } from 'zlib';
import { describe, expect, it } from 'vitest';
import { MASK_TRACK_VERSION, type MaskFrameEntry, type MaskTrackIndex } from './mask-track';
import { MASK_WINDOW, createMaskReader, inflateMask, type MaskRangeFetcher } from './mask-reader';

const W = 8;
const H = 4;

/** A bin of `count` frames at 24 fps from `start` (mask k is filled with the value k), appended after `base`. */
function buildBin(count: number, start = 0, base: Uint8Array = new Uint8Array(0)): { bin: Uint8Array; frames: MaskFrameEntry[] } {
  const parts: Uint8Array[] = [base];
  const frames: MaskFrameEntry[] = [];
  let offset = base.length;
  for (let k = 0; k < count; k++) {
    const blob = deflateSync(new Uint8Array(W * H).fill(k % 256));
    frames.push([Math.round((start + k / 24) * 1e5) / 1e5, offset, blob.length]);
    parts.push(blob);
    offset += blob.length;
  }
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const p of parts) {
    bin.set(p, at);
    at += p.length;
  }
  return { bin, frames };
}

function indexOf(frames: MaskFrameEntry[], bytes: number, overrides: Partial<MaskTrackIndex> = {}): MaskTrackIndex {
  return {
    version: MASK_TRACK_VERSION, kind: 'mask', source: { width: 640, height: 360 }, mask: { width: W, height: H },
    input: { width: 896, height: 512 }, fps: 24, spans: [[0, 10]], ep: 'dml', models: { modnet: 'x' }, bytes,
    generatedAt: '', frames, ...overrides,
  };
}

function fetcherOver(bin: Uint8Array): MaskRangeFetcher & { calls: [number, number][] } {
  const calls: [number, number][] = [];
  const fetch = (async (offset: number, length: number) => {
    calls.push([offset, length]);
    if (offset + length > bin.length) throw new Error('past the end');
    return bin.slice(offset, offset + length);
  }) as MaskRangeFetcher & { calls: [number, number][] };
  fetch.calls = calls;
  return fetch;
}

describe('inflateMask', () => {
  it('inflates one zlib stream (Node zlib on the way in, DecompressionStream on the way out)', async () => {
    const raw = new Uint8Array(1000).map((_, i) => i % 7);
    expect([...(await inflateMask(deflateSync(raw)))]).toEqual([...raw]);
  });
});

describe('createMaskReader', () => {
  it('is pending, loads the whole window in ONE read when the blobs are contiguous, then answers synchronously', async () => {
    const { bin, frames } = buildBin(100);
    const fetch = fetcherOver(bin);
    const reader = createMaskReader(indexOf(frames, bin.length), fetch);
    const t = 5 / 24;
    expect(reader.state(t)).toBe('pending');
    expect(reader.maskAt(t)).toBeNull(); // starts the load
    await reader.load(t);
    expect(fetch.calls.length).toBe(1);
    expect(fetch.calls[0]).toEqual([0, frames[MASK_WINDOW - 1][1] + frames[MASK_WINDOW - 1][2]]);
    const mask = reader.maskAt(t);
    expect(mask).toMatchObject({ width: W, height: H, t: frames[5][0] });
    expect(mask?.data).toBeInstanceOf(Uint8ClampedArray);
    expect(mask?.data.every((v) => v === 5)).toBe(true);
    expect(reader.state(t)).toBe('ready');
  });

  it('prefetches the next window from the second half of one, and notifies after each landing', async () => {
    const { bin, frames } = buildBin(100);
    const fetch = fetcherOver(bin);
    const reader = createMaskReader(indexOf(frames, bin.length), fetch);
    let landed = 0;
    const off = reader.subscribe(() => landed++);
    await reader.load(30 / 24); // second half of window 0
    await new Promise((r) => setTimeout(r, 20));
    expect(fetch.calls.length).toBe(2);
    expect(reader.state(MASK_WINDOW / 24)).toBe('ready');
    expect(landed).toBe(2);
    off();
    await reader.load(99 / 24);
    expect(landed).toBe(2);
  });

  it('reads one range per contiguous run when two analysis runs interleave in the bin', async () => {
    // Run 1 covers 1.0–1.5 s, run 2 (appended later) covers 0–0.5 s: time order ≠ byte order.
    const late = buildBin(12, 1);
    const early = buildBin(12, 0, late.bin);
    const frames = [...early.frames, ...late.frames].sort((a, b) => a[0] - b[0]);
    const fetch = fetcherOver(early.bin);
    const reader = createMaskReader(indexOf(frames, early.bin.length), fetch);
    await reader.load(0);
    expect(fetch.calls.length).toBe(2);
    expect(reader.maskAt(1 + 3 / 24)?.data[0]).toBe(3);
    expect(reader.maskAt(3 / 24)?.data[0]).toBe(3);
  });

  it('treats a blob that fails to read or inflate as no mask there — and load still settles', async () => {
    const { bin, frames } = buildBin(4);
    const broken = bin.slice();
    broken.fill(0, frames[2][1], frames[2][1] + frames[2][2]); // frame 2's blob is garbage
    const reader = createMaskReader(indexOf(frames, bin.length), fetcherOver(broken));
    await reader.load(0);
    expect(reader.state(2 / 24)).toBe('none');
    expect(reader.maskAt(2 / 24)).toBeNull();
    expect(reader.maskAt(3 / 24)?.data[0]).toBe(3);

    const failing = createMaskReader(indexOf(frames, bin.length), async () => {
      throw new Error('disk gone');
    });
    await expect(failing.load(0)).resolves.toBeUndefined();
    expect(failing.state(0)).toBe('none');
  });

  it('answers a gap with none and a still with its one frame everywhere', async () => {
    const { bin, frames } = buildBin(3);
    const reader = createMaskReader(indexOf(frames, bin.length), fetcherOver(bin));
    expect(reader.state(5)).toBe('none');
    await expect(reader.load(5)).resolves.toBeUndefined();

    const still = buildBin(1);
    const stillReader = createMaskReader(indexOf(still.frames, still.bin.length, { static: true, fps: 1 }), fetcherOver(still.bin));
    await stillReader.load(123);
    expect(stillReader.maskAt(0)?.data[0]).toBe(0);
    expect(stillReader.maskAt(99.9)).not.toBeNull();
  });
});
