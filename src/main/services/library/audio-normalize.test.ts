// The loudness normalizer through the REAL bundled ffmpeg (E2). Fixtures are 48 kHz mono 16-bit PCM WAVs written
// here (no source filters needed — the bundled build has no `anoisesrc` anyway). Independent checks: a WAV output's
// sample peak is read from its PCM in JS (no ffmpeg), the loudness by a second analysis pass. Only `utils/paths`
// is mocked (it imports electron); `@remotion/renderer` resolves the real compositor ffmpeg.
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/paths', () => ({ getRemotionBinariesDir: () => null }));

const { measureLoudness, normalizeAudioFile } = await import('./audio-normalize');
const { getFfmpegBinary, runFfmpeg } = await import('../studio/ffmpeg-bin');
const { gaplessDuration, readMp3Gapless } = await import('../studio/mp3-gapless');

const SR = 48_000;
const seconds = (s: number) => Math.round(s * SR);
let dir = '';

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2-normalize-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function wav(samples: Float64Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** The sample peak (dBFS) of a 16-bit PCM WAV, walking its chunks (ffmpeg writes a LIST chunk before `data`). */
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

const sineAt = (i: number, hz: number) => Math.sin((2 * Math.PI * hz * i) / SR);

/** (A) a 1 kHz tone at about −12 LUFS with a 5 ms spike to −0.3 dBFS — gain down, the ceiling does not bind. */
function toneWithSpike(): Float64Array {
  const out = new Float64Array(seconds(3));
  for (let i = 0; i < out.length; i++) out[i] = 0.35 * sineAt(i, 1000);
  for (let i = seconds(1); i < seconds(1.005); i++) out[i] = 0.966 * sineAt(i, 1000);
  return out;
}

/** (B) a 2 ms click every 250 ms at −6 dBFS: about −30 LUFS, so −20 would push the peak to +4 — the clamp. */
function clickTrain(): Float64Array {
  const out = new Float64Array(seconds(3));
  const len = seconds(0.002);
  const ramp = seconds(0.0005);
  for (let t = seconds(0.1); t + len < out.length; t += seconds(0.25)) {
    for (let k = 0; k < len; k++) {
      const env = k < ramp ? k / ramp : k >= len - ramp ? (len - k) / ramp : 1;
      out[t + k] = 0.5 * env * sineAt(k, 1000);
    }
  }
  return out;
}

/** (C) 0.3 s in all: shorter than one 400 ms R128 block — integrated loudness is gated. */
function shortBurst(): Float64Array {
  const out = new Float64Array(seconds(0.3));
  for (let i = seconds(0.05); i < seconds(0.2); i++) out[i] = 0.25 * sineAt(i, 1000);
  return out;
}

/** (D) a 6 s quiet bed: a 220 Hz tone under seeded noise, about −30 LUFS, peak about −23 dBFS. */
function bed(): Float64Array {
  const out = new Float64Array(seconds(6));
  let seed = 12345;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = 0.05 * sineAt(i, 220) + 0.02 * ((seed / 4294967296) * 2 - 1);
  }
  return out;
}

async function fixture(name: string, samples: Float64Array): Promise<string> {
  const p = path.join(dir, name);
  await fs.writeFile(p, wav(samples));
  return p;
}

/** ffprobe's container duration minus the LAME delay + padding (what E1's library probe stores). */
async function mp3Duration(p: string): Promise<number> {
  const ffprobe = await getFfmpegBinary('ffprobe');
  const out = await new Promise<string>((resolve, reject) => {
    execFile(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', p], (err, stdout) =>
      err ? reject(err) : resolve(stdout),
    );
  });
  return gaplessDuration(parseFloat(out), await readMp3Gapless(p));
}

const tempFiles = async () => (await fs.readdir(dir)).filter((n) => n.includes('norm-tmp'));

describe('normalizeAudioFile — the real bundled ffmpeg', () => {
  it('(A) a loud steady tone comes DOWN to −20 LUFS; the ceiling does not bind', async () => {
    const p = await fixture('a-tone.wav', toneWithSpike());
    const before = await measureLoudness(p);
    expect(before.truePeakDbtp).toBeGreaterThan(-0.6);
    expect(before.truePeakDbtp).toBeLessThan(0.2);
    const r = await normalizeAudioFile(p);
    expect(r).toMatchObject({ normalized: true, clamped: false, gated: false, skipped: false });
    expect(r.gainDb).toBeLessThan(-5);
    expect(Math.abs(r.loudnessLufs! + 20)).toBeLessThanOrEqual(0.5);
    expect(r.peakDbfs!).toBeLessThanOrEqual(-1.5);
    expect(r.before).toEqual({ loudnessLufs: before.integratedLufs, peakDbfs: before.truePeakDbtp });
    // Independent: the output's sample peak from its PCM, and a second analysis pass.
    const outPeak = wavPeakDbfs(await fs.readFile(p));
    expect(outPeak).toBeLessThanOrEqual(-1.5);
    expect(Math.abs(outPeak - (before.truePeakDbtp + r.gainDb))).toBeLessThan(0.3);
    const again = await measureLoudness(p);
    expect(Math.abs(again.integratedLufs + 20)).toBeLessThanOrEqual(0.5);
    expect(await tempFiles()).toEqual([]);
  });

  it('(B) the ceiling binds: a quiet click train gets only ceiling − peak and lands at −1.5 dBTP', async () => {
    const p = await fixture('b-clicks.wav', clickTrain());
    const before = await measureLoudness(p);
    expect(before.integratedLufs).toBeLessThan(-24);
    expect(before.integratedLufs).toBeGreaterThan(-50);
    const r = await normalizeAudioFile(p);
    expect(r).toMatchObject({ normalized: true, clamped: true, gated: false, skipped: false });
    expect(Math.abs(r.gainDb - (-1.5 - before.truePeakDbtp))).toBeLessThan(0.02);
    expect(Math.abs(r.peakDbfs! + 1.5)).toBeLessThanOrEqual(0.1);
    expect(r.loudnessLufs!).toBeLessThan(-22); // honestly short of the target
    expect(wavPeakDbfs(await fs.readFile(p))).toBeLessThanOrEqual(-1.45);
  });

  it('(C) a sound under 0.4 s is gated → peak-normalized to the ceiling', async () => {
    const p = await fixture('c-short.wav', shortBurst());
    const r = await normalizeAudioFile(p);
    expect(r).toMatchObject({ normalized: true, gated: true, skipped: false });
    expect(Math.abs(r.peakDbfs! + 1.5)).toBeLessThanOrEqual(0.1);
    expect(wavPeakDbfs(await fs.readFile(p))).toBeLessThanOrEqual(-1.45);
  });

  it('(D) a 6 s quiet bed comes UP to −20 LUFS', async () => {
    const p = await fixture('d-bed.wav', bed());
    const r = await normalizeAudioFile(p);
    expect(r).toMatchObject({ normalized: true, clamped: false, gated: false, skipped: false });
    expect(r.gainDb).toBeGreaterThan(5);
    expect(Math.abs(r.loudnessLufs! + 20)).toBeLessThanOrEqual(0.5);
    expect(r.peakDbfs!).toBeLessThanOrEqual(-1.5);
    expect(r.before?.loudnessLufs).toBeLessThan(-25);
  });

  it('(E) an mp3 keeps its extension and its gapless duration, and lands at −20 LUFS', async () => {
    const src = await fixture('e-src.wav', toneWithSpike());
    const mp3 = path.join(dir, 'e-tone.mp3');
    await runFfmpeg(await getFfmpegBinary('ffmpeg'), ['-hide_banner', '-nostdin', '-y', '-i', src, '-c:a', 'libmp3lame', '-b:a', '128k', mp3]);
    const durBefore = await mp3Duration(mp3);
    const r = await normalizeAudioFile(mp3);
    expect(r).toMatchObject({ normalized: true, clamped: false, gated: false });
    expect(Math.abs(r.loudnessLufs! + 20)).toBeLessThanOrEqual(0.5);
    expect(r.peakDbfs!).toBeLessThanOrEqual(-1.5);
    const durAfter = await mp3Duration(mp3);
    expect(Math.abs(durAfter - durBefore)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(durAfter - 3)).toBeLessThanOrEqual(0.01);
    expect(await tempFiles()).toEqual([]);
  });

  it('(F) an extension the apply step cannot encode → not normalized, bytes unchanged, measured values recorded', async () => {
    const p = await fixture('f-wav-named.flac', toneWithSpike()); // WAV bytes behind an extension with no encoder here
    const bytes = await fs.readFile(p);
    const r = await normalizeAudioFile(p);
    expect(r.normalized).toBe(false);
    expect(r.error).toMatch(/apply failed: unsupported container/);
    expect(r.gainDb).toBe(0);
    expect(r.loudnessLufs).toBeGreaterThan(-16); // the measured, unchanged file
    expect(Buffer.compare(await fs.readFile(p), bytes)).toBe(0);
    expect(await tempFiles()).toEqual([]);
  });

  it('(F) unreadable input → the measure pass fails, nothing is written', async () => {
    const p = path.join(dir, 'f-empty.mp3');
    await fs.writeFile(p, Buffer.alloc(0));
    const r = await normalizeAudioFile(p);
    expect(r.normalized).toBe(false);
    expect(r.error).toMatch(/measure failed/);
    expect((await fs.stat(p)).size).toBe(0);
    expect(await tempFiles()).toEqual([]);
  });

  it('(F) a cancelled signal → not normalized, bytes unchanged', async () => {
    const p = await fixture('f-cancel.wav', toneWithSpike());
    const bytes = await fs.readFile(p);
    const r = await normalizeAudioFile(p, { signal: AbortSignal.abort() });
    expect(r.normalized).toBe(false);
    expect(r.error).toMatch(/Cancelled/);
    expect(Buffer.compare(await fs.readFile(p), bytes)).toBe(0);
  });
});
