import fs from 'fs/promises';

/**
 * Gapless info of an MP3 from its first frame's Xing/Info + LAME tag — the same fields
 * ffmpeg's mp3 demuxer reads (`mp3_parse_info_tag`). The bundled Remotion ffprobe (n7.1)
 * reports a LAME mp3's duration as frames × samples-per-frame / rate, i.e. WITH the encoder
 * delay and end padding (a 1.3 s tone reads 1.344 s); the decoder trims both, so the
 * playable length is shorter by (startPad + endPad) samples. Found in the E1 live check.
 */
export interface Mp3GaplessInfo {
  frames: number;
  samplesPerFrame: number;
  sampleRate: number;
  startPad: number;
  endPad: number;
}

const SAMPLE_RATES = [44100, 48000, 32000];
/** How far past the ID3 tag the first frame may start (zero padding etc.). */
const SYNC_SCAN_BYTES = 4096;
const READ_WINDOW = SYNC_SCAN_BYTES + 1024;
const GAPLESS_ENCODERS = ['LAME', 'Lavf', 'Lavc'];

/** Parse the first MPEG audio frame of `buf`; undefined when it carries no gapless info. */
export function parseMp3Gapless(buf: Buffer): Mp3GaplessInfo | undefined {
  const limit = Math.min(buf.length - 4, SYNC_SCAN_BYTES);
  for (let i = 0; i < limit; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const version = (buf[i + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const layer = (buf[i + 1] >> 1) & 3; // 1 = layer III
    const bitrateIndex = buf[i + 2] >> 4;
    const rateIndex = (buf[i + 2] >> 2) & 3;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) continue;
    const mpeg1 = version === 3;
    const mono = buf[i + 3] >> 6 === 3;
    const sampleRate = SAMPLE_RATES[rateIndex] / (mpeg1 ? 1 : version === 2 ? 2 : 4);
    const samplesPerFrame = mpeg1 ? 1152 : 576;
    return parseInfoTag(buf, i + 4 + (mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17), sampleRate, samplesPerFrame);
  }
  return undefined;
}

function parseInfoTag(buf: Buffer, at: number, sampleRate: number, samplesPerFrame: number): Mp3GaplessInfo | undefined {
  if (at + 8 > buf.length) return undefined;
  const tag = buf.toString('latin1', at, at + 4);
  if (tag !== 'Xing' && tag !== 'Info') return undefined;
  const flags = buf.readUInt32BE(at + 4);
  if (!(flags & 1)) return undefined;
  let p = at + 8;
  const frames = buf.readUInt32BE(p);
  p += 4;
  if (flags & 2) p += 4;
  if (flags & 4) p += 100;
  if (flags & 8) p += 4;
  if (p + 24 > buf.length) return undefined;
  if (!GAPLESS_ENCODERS.includes(buf.toString('latin1', p, p + 4))) return undefined;
  const v = buf.readUIntBE(p + 21, 3);
  return { frames, samplesPerFrame, sampleRate, startPad: v >> 12, endPad: v & 0xfff };
}

/**
 * The playable duration: trims delay + padding only when `rawDuration` is the untrimmed
 * frame total (what the bundled ffprobe prints). A duration ffprobe already trimmed (newer
 * builds) or estimated another way is returned as is.
 */
export function gaplessDuration(rawDuration: number, info: Mp3GaplessInfo | undefined): number {
  if (!info || info.frames <= 0) return rawDuration;
  const total = info.frames * info.samplesPerFrame;
  const pads = info.startPad + info.endPad;
  if (pads <= 0 || pads >= total) return rawDuration;
  if (Math.abs(rawDuration - total / info.sampleRate) > 0.001) return rawDuration;
  return (total - pads) / info.sampleRate;
}

/** Read the gapless info of an mp3 on disk (skips an ID3v2 tag); never throws. */
export async function readMp3Gapless(filePath: string): Promise<Mp3GaplessInfo | undefined> {
  try {
    const handle = await fs.open(filePath, 'r');
    try {
      const head = Buffer.alloc(10);
      await handle.read(head, 0, 10, 0);
      let offset = 0;
      if (head.toString('latin1', 0, 3) === 'ID3') {
        const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
        offset = 10 + size + (head[5] & 0x10 ? 10 : 0);
      }
      const buf = Buffer.alloc(READ_WINDOW);
      const { bytesRead } = await handle.read(buf, 0, READ_WINDOW, offset);
      return parseMp3Gapless(buf.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  } catch {
    return undefined;
  }
}
