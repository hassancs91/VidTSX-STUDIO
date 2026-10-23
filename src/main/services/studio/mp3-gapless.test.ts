import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { gaplessDuration, parseMp3Gapless, readMp3Gapless } from './mp3-gapless';

// E1 live finding (2026-10-23): the bundled Remotion ffprobe (n7.1) reports a LAME mp3's
// duration as frames × 1152 / rate (1.344 s for a 1.3 s tone) — encoder delay + padding
// included — while the true length (and ffprobe n8) is 1.300 s.

interface FrameOpts {
  mpeg1?: boolean;
  mono?: boolean;
  tag?: string;
  flags?: number;
  frames?: number;
  encoder?: string;
  delay?: number;
  padding?: number;
}

/** One Xing/Info frame as LAME writes it (first frame of the file). */
function infoFrame(o: FrameOpts = {}): Buffer {
  const { mpeg1 = true, mono = false, tag = 'Info', flags = 0x0f, frames = 56 } = o;
  const { encoder = 'LAME3.100', delay = 576, padding = 1536 } = o;
  const buf = Buffer.alloc(417);
  buf[0] = 0xff;
  buf[1] = mpeg1 ? 0xfb : 0xf3; // MPEG-1 / MPEG-2, layer III, no CRC
  buf[2] = 0x94; // bitrate index 9, sample-rate index 1 (48 kHz / 24 kHz)
  buf[3] = mono ? 0xc0 : 0x00;
  let p = 4 + (mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17);
  buf.write(tag, p, 'latin1');
  buf.writeUInt32BE(flags, p + 4);
  p += 8;
  if (flags & 1) { buf.writeUInt32BE(frames, p); p += 4; }
  if (flags & 2) { buf.writeUInt32BE(21933, p); p += 4; }
  if (flags & 4) p += 100;
  if (flags & 8) { buf.writeUInt32BE(57, p); p += 4; }
  buf.write(encoder.padEnd(9, '\0').slice(0, 9), p, 'latin1');
  const v = (delay << 12) | padding;
  buf[p + 21] = (v >> 16) & 0xff;
  buf[p + 22] = (v >> 8) & 0xff;
  buf[p + 23] = v & 0xff;
  return buf;
}

function id3v2(bodyBytes: number): Buffer {
  const head = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
  head[6] = (bodyBytes >> 21) & 0x7f;
  head[7] = (bodyBytes >> 14) & 0x7f;
  head[8] = (bodyBytes >> 7) & 0x7f;
  head[9] = bodyBytes & 0x7f;
  return Buffer.concat([head, Buffer.alloc(bodyBytes)]);
}

describe('parseMp3Gapless', () => {
  it('reads frames, rate and the LAME delay/padding from an MPEG-1 Info frame', () => {
    expect(parseMp3Gapless(infoFrame())).toEqual({
      frames: 56, samplesPerFrame: 1152, sampleRate: 48000, startPad: 576, endPad: 1536,
    });
  });

  it('finds the frame after leading zero bytes and handles MPEG-2 mono (Xing, 576 samples/frame)', () => {
    const buf = Buffer.concat([Buffer.alloc(100), infoFrame({ mpeg1: false, mono: true, tag: 'Xing' })]);
    expect(parseMp3Gapless(buf)).toEqual({
      frames: 56, samplesPerFrame: 576, sampleRate: 24000, startPad: 576, endPad: 1536,
    });
  });

  it('accepts Lavf/Lavc encoder strings, rejects others and frames without a tag or frame count', () => {
    expect(parseMp3Gapless(infoFrame({ encoder: 'Lavf61.7' }))?.endPad).toBe(1536);
    expect(parseMp3Gapless(infoFrame({ encoder: 'GOGO1.0' }))).toBeUndefined();
    expect(parseMp3Gapless(infoFrame({ tag: 'Nope' }))).toBeUndefined();
    expect(parseMp3Gapless(infoFrame({ flags: 0x0e }))).toBeUndefined();
    expect(parseMp3Gapless(Buffer.from('RIFF....WAVEfmt '))).toBeUndefined();
  });
});

describe('gaplessDuration', () => {
  const info = { frames: 56, samplesPerFrame: 1152, sampleRate: 48000, startPad: 576, endPad: 1536 };

  it('trims delay + padding when ffprobe reported the untrimmed frame total', () => {
    expect(gaplessDuration(1.344, info)).toBeCloseTo(1.3, 9);
  });

  it('keeps a duration ffprobe already trimmed (newer ffprobe) or estimated differently', () => {
    expect(gaplessDuration(1.3, info)).toBe(1.3);
    expect(gaplessDuration(2.5, info)).toBe(2.5);
    expect(gaplessDuration(1.344, undefined)).toBe(1.344);
    expect(gaplessDuration(1.344, { ...info, startPad: 0, endPad: 0 })).toBe(1.344);
  });
});

describe('readMp3Gapless', () => {
  it('skips an ID3v2 tag larger than its read window and never throws', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mp3-gapless-'));
    try {
      const file = path.join(dir, 'tagged.mp3');
      await fs.writeFile(file, Buffer.concat([id3v2(40_000), infoFrame()]));
      expect(await readMp3Gapless(file)).toMatchObject({ frames: 56, startPad: 576, endPad: 1536 });
      expect(await readMp3Gapless(path.join(dir, 'missing.mp3'))).toBeUndefined();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
