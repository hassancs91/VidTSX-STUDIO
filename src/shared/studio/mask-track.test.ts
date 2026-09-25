import { describe, expect, it } from 'vitest';
import {
  MASK_MAX_SIDE,
  MASK_TRACK_VERSION,
  maskBlobRelPath,
  maskEntryIndexAt,
  maskIndexRelPath,
  maskSizeFor,
  maskTrackCompatible,
  mergeMaskIndex,
  parseMaskIndex,
  serializeMaskIndex,
  type MaskFrameEntry,
  type MaskTrackIndex,
} from './mask-track';

/** Frames at `fps` from `start`, each blob `len` bytes, packed from `offset`. */
function run(start: number, count: number, fps: number, offset: number, len = 100): MaskFrameEntry[] {
  return Array.from({ length: count }, (_, k): MaskFrameEntry => [Math.round((start + k / fps) * 1e5) / 1e5, offset + k * len, len]);
}

const index = (frames: MaskFrameEntry[], overrides: Partial<MaskTrackIndex> = {}): MaskTrackIndex => ({
  version: MASK_TRACK_VERSION,
  kind: 'mask',
  source: { width: 960, height: 540 },
  mask: { width: 256, height: 144 },
  input: { width: 896, height: 512 },
  fps: 24,
  spans: [[0, 1]],
  ep: 'dml',
  models: { modnet: 'abc' },
  bytes: frames.reduce((n, f) => Math.max(n, f[1] + f[2]), 0),
  generatedAt: '2026-09-25T00:00:00.000Z',
  frames,
  ...overrides,
});

describe('mask track paths and sizes', () => {
  it('lives beside the faces track, index + blobs', () => {
    expect(maskIndexRelPath('asset-1')).toBe('analysis/asset-1/mask-v1.json');
    expect(maskBlobRelPath('asset-1')).toBe('analysis/asset-1/mask-v1.bin');
  });

  it('stores at most 256 px on the long side, the aspect kept, never upscaled', () => {
    expect(maskSizeFor(960, 540)).toEqual({ width: 256, height: 144 });
    expect(maskSizeFor(1920, 1080)).toEqual({ width: 256, height: 144 });
    expect(maskSizeFor(1080, 1920)).toEqual({ width: 144, height: 256 });
    expect(maskSizeFor(1440, 1080)).toEqual({ width: 256, height: 192 });
    expect(maskSizeFor(200, 100)).toEqual({ width: 200, height: 100 });
    expect(Math.max(...Object.values(maskSizeFor(4000, 3000)))).toBe(MASK_MAX_SIDE);
  });
});

describe('the index file', () => {
  it('round-trips through its text, one frame per line, sorted and unique by time', () => {
    const idx = index([...run(0.5, 3, 24, 300), ...run(0, 3, 24, 0)], { spans: [[0.5, 0.6], [0, 0.1]] });
    const text = serializeMaskIndex(idx);
    expect(text.split('\n').length).toBeGreaterThan(6);
    const back = parseMaskIndex(JSON.parse(text));
    expect(back?.frames.map((f) => f[0])).toEqual([0, 0.04167, 0.08333, 0.5, 0.54167, 0.58333]);
    expect(back?.spans).toEqual([[0, 0.1], [0.5, 0.6]]);
    expect(back).toMatchObject({ mask: { width: 256, height: 144 }, input: { width: 896, height: 512 }, ep: 'dml', bytes: 600 });
  });

  it('refuses what this build cannot read: version, kind, a mask over the cap, a blob outside the described bytes', () => {
    const good = JSON.parse(serializeMaskIndex(index(run(0, 2, 24, 0)))) as Record<string, unknown>;
    expect(parseMaskIndex(good)).not.toBeNull();
    expect(parseMaskIndex({ ...good, version: 2 })).toBeNull();
    expect(parseMaskIndex({ ...good, kind: 'faces' })).toBeNull();
    expect(parseMaskIndex({ ...good, mask: { width: 512, height: 288 } })).toBeNull();
    expect(parseMaskIndex({ ...good, bytes: 150 })).toBeNull(); // frame 2 ends at 200
    expect(parseMaskIndex({ ...good, frames: [[0, 0, 0]] })).toBeNull(); // empty blob
    expect(parseMaskIndex({ ...good, frames: [[0, 0]] })).toBeNull();
    expect(parseMaskIndex({ ...good, ep: 'cuda' })).toBeNull();
    expect(parseMaskIndex({ ...good, spans: [[1, 0]] })).toBeNull();
  });
});

describe('the union over one append-only bin', () => {
  it('appends a later run: frames by time (the addition wins), spans merged, bytes the larger', () => {
    const first = index(run(0, 24, 24, 0), { spans: [[0, 1]] });
    // The second run starts on the grid at 1.0 and re-analyses frame t=0.95833 too.
    const second = index(run(0.95833, 25, 24, 2400), { spans: [[0.95833, 2]], ep: 'cpu', input: { width: 608, height: 352 } });
    const merged = mergeMaskIndex(first, second);
    expect(merged.spans).toEqual([[0, 2]]);
    expect(merged.bytes).toBe(4900);
    expect(merged.frames.length).toBe(48);
    expect(merged.frames.find((f) => f[0] === 0.95833)?.[1]).toBe(2400); // the addition's blob
    expect(merged).toMatchObject({ ep: 'cpu', input: { width: 608, height: 352 } });
  });

  it('drops an incompatible cache: another fps, model or stored mask size', () => {
    const first = index(run(0, 3, 24, 0));
    expect(maskTrackCompatible(first, { fps: 24, models: { modnet: 'abc' }, mask: { width: 256, height: 144 } })).toBe(true);
    expect(maskTrackCompatible(first, { fps: 30, models: { modnet: 'abc' }, mask: { width: 256, height: 144 } })).toBe(false);
    expect(maskTrackCompatible(first, { fps: 24, models: { modnet: 'new' }, mask: { width: 256, height: 144 } })).toBe(false);
    expect(maskTrackCompatible(first, { fps: 24, models: { modnet: 'abc' }, mask: { width: 256, height: 192 } })).toBe(false);
    const fresh = index(run(5, 2, 30, 0), { fps: 30, spans: [[5, 5.1]] });
    expect(mergeMaskIndex(first, fresh)).toMatchObject({ fps: 30, spans: [[5, 5.1]], bytes: 200, frames: fresh.frames });
  });
});

describe('maskEntryIndexAt', () => {
  const idx = index([...run(0, 10, 24, 0), ...run(2, 10, 24, 1000)]);

  it('finds the nearest frame within half a frame, and nothing in a gap', () => {
    expect(maskEntryIndexAt(idx, 0)).toBe(0);
    expect(maskEntryIndexAt(idx, 1 / 24 + 0.01)).toBe(1);
    expect(maskEntryIndexAt(idx, 0.5 / 24)).toBeGreaterThanOrEqual(0); // exactly between two frames still resolves
    expect(maskEntryIndexAt(idx, 1.0)).toBe(-1); // the gap between the runs plays plain
    expect(maskEntryIndexAt(idx, 2 + 3 / 24)).toBe(13);
    expect(maskEntryIndexAt(idx, Number.NaN)).toBe(-1);
    expect(maskEntryIndexAt(index([]), 0)).toBe(-1);
  });

  it('answers a still with its one frame at every time', () => {
    const still = index([[0, 0, 100]], { static: true, fps: 1, spans: [[0, 0]] });
    expect(maskEntryIndexAt(still, 0)).toBe(0);
    expect(maskEntryIndexAt(still, 42.5)).toBe(0);
  });
});
