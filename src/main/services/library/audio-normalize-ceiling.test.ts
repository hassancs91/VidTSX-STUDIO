// E-d11 (E2 verifier round 1, F1): the −1.5 dBTP ceiling is a property of the ENCODED file the library keeps,
// not of the pre-encode plan. A lossy re-encode can push a peak-normalized transient a few tenths OVER the
// ceiling; the normalizer re-measures the encoded output and, when it is over, re-encodes from the ORIGINAL with
// less gain. Through the REAL bundled ffmpeg (only `utils/paths` mocked; `runFfmpeg` wrapped in a spy so the test
// can see what each encode read). The fixture is JS-made noise (the bundled build has no `anoisesrc`), mp3'd by
// the bundled ffmpeg. Independent check: the output decoded to 16-bit PCM, its sample peak computed here in JS.
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => null }));
vi.mock('../studio/ffmpeg-bin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../studio/ffmpeg-bin')>();
  return { ...real, runFfmpeg: vi.fn(real.runFfmpeg) };
});

const { normalizeAudioFile } = await import('./audio-normalize');
const { getFfmpegBinary, runFfmpeg } = await import('../studio/ffmpeg-bin');

const SR = 44_100;
let dir = '';

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2-ceiling-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** A 44.1 kHz STEREO 16-bit PCM WAV from two channels of samples in [-1, 1]. */
function stereoWav(left: Float64Array, right: Float64Array): Buffer {
  const data = Buffer.alloc(left.length * 4);
  for (let i = 0; i < left.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(2, 22); // stereo
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** The sample peak (dBFS) over every 16-bit sample of a PCM WAV's `data` chunk (any channel count). */
function wavPeakDbfs(buf: Buffer): number {
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      let peak = 0;
      const end = Math.min(buf.length, off + 8 + size);
      for (let p = off + 8; p + 1 < end; p += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(p)));
      return 20 * Math.log10(peak / 32768);
    }
    off += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}

/** 0.25 s in all: a white-noise burst (seeded LCG, 3 ms ramps) at about −10 dBFS — under one R128 block, so gated. */
function noiseBurst(seed: number): Float64Array {
  const out = new Float64Array(Math.round(0.25 * SR));
  const start = Math.round(0.01 * SR);
  const end = Math.round(0.24 * SR);
  const ramp = Math.round(0.003 * SR);
  let s = seed >>> 0;
  for (let i = start; i < end; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const env = Math.min(1, (i - start) / ramp, (end - i) / ramp);
    out[i] = 0.3 * env * ((s / 4294967296) * 2 - 1);
  }
  return out;
}

const ffmpegArgs = (...args: string[]) => ['-hide_banner', '-nostdin', '-y', ...args];

async function mp3Fixture(name: string): Promise<string> {
  const src = path.join(dir, `${name}.src.wav`);
  await fs.writeFile(src, stereoWav(noiseBurst(12345), noiseBurst(67890)));
  const mp3 = path.join(dir, `${name}.mp3`);
  await runFfmpeg(await getFfmpegBinary('ffmpeg'), ffmpegArgs('-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', mp3));
  return mp3;
}

/** Independent of the product's `loudnorm` meter: decode to 16-bit PCM and take the sample peak in JS. */
async function decodedPeakDbfs(mp3: string): Promise<number> {
  const out = `${mp3}.decoded.wav`;
  await runFfmpeg(await getFfmpegBinary('ffmpeg'), ffmpegArgs('-i', mp3, '-c:a', 'pcm_s16le', '-f', 'wav', out));
  return wavPeakDbfs(await fs.readFile(out));
}

const tempFiles = async () => (await fs.readdir(dir)).filter((n) => n.includes('norm-tmp'));

describe('normalizeAudioFile — the ceiling holds on the ENCODED mp3 (E-d11)', () => {
  it('a 0.25 s stereo noise burst (gated branch) that overshoots on one re-encode lands at or under −1.5 dBTP', async () => {
    const mp3 = await mp3Fixture('burst');
    const spy = vi.mocked(runFfmpeg);
    spy.mockClear();

    const r = await normalizeAudioFile(mp3);
    const productCalls = [...spy.mock.calls]; // before the test's own decode below

    expect(r).toMatchObject({ normalized: true, gated: true, skipped: false });
    expect(r.peakDbfs!).toBeLessThanOrEqual(-1.5);
    expect(await decodedPeakDbfs(mp3)).toBeLessThanOrEqual(-1.5);
    // The fixture overshoots on the planned gain (that is the case under test) → at least one corrective pass,
    // with less gain than the plan's `ceiling − peak`, and NO overshoot left to report.
    expect(r.correctivePasses).toBeGreaterThanOrEqual(1);
    expect(r.overCeiling).toBeUndefined();
    expect(r.gainDb).toBeLessThan(-1.5 - r.before!.peakDbfs!);
    // One lossy generation only: every encode read the ORIGINAL bytes, never an earlier pass's output.
    const encodes = productCalls.filter(([, args]) => args.includes('-c:a'));
    expect(encodes).toHaveLength(1 + r.correctivePasses!);
    for (const [, args] of encodes) expect(args[args.indexOf('-i') + 1]).toBe(mp3);
    expect(path.extname(mp3)).toBe('.mp3');
    expect(await tempFiles()).toEqual([]);
  });
});
