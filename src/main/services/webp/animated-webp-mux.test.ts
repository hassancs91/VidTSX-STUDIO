import { describe, it, expect } from 'vitest';
import { muxAnimatedWebp } from './animated-webp-mux';

// ─── helpers to build synthetic single-image WebP inputs ───

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

function chunk(fourCC: string, payload: Buffer): Buffer {
  const parts = [Buffer.from(fourCC, 'ascii'), u32le(payload.length), payload];
  if (payload.length % 2 === 1) parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function webpFile(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat(chunks);
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    u32le(4 + body.length),
    Buffer.from('WEBP', 'ascii'),
    body,
  ]);
}

/** Simple lossy layout: RIFF/WEBP + single "VP8 " chunk. */
function lossyWebp(payload: Buffer): Buffer {
  return webpFile(chunk('VP8 ', payload));
}

/** VP8L payload with the alpha_is_used header bit set or cleared. */
function vp8lPayload(alpha: boolean): Buffer {
  // Signature byte + LE uint32: 14b width-1 | 14b height-1 | 1b alpha | 3b version
  const header = ((alpha ? 1 : 0) << 28) >>> 0;
  return Buffer.concat([Buffer.from([0x2f]), u32le(header), Buffer.from([0xaa, 0xbb])]);
}

// ─── output structure parsing ───

interface OutChunk {
  fourCC: string;
  payload: Buffer;
}

function parseChunks(file: Buffer, start: number, end: number): OutChunk[] {
  const chunks: OutChunk[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const fourCC = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    chunks.push({ fourCC, payload: file.subarray(offset + 8, offset + 8 + size) });
    offset += 8 + size + (size % 2);
  }
  expect(offset).toBe(end); // no trailing garbage, padding consistent
  return chunks;
}

function parseWebp(file: Buffer): OutChunk[] {
  expect(file.toString('ascii', 0, 4)).toBe('RIFF');
  expect(file.toString('ascii', 8, 12)).toBe('WEBP');
  expect(file.readUInt32LE(4)).toBe(file.length - 8);
  return parseChunks(file, 12, file.length);
}

describe('muxAnimatedWebp', () => {
  it('produces a valid animated container from lossy frames', () => {
    const out = muxAnimatedWebp({
      width: 320,
      height: 240,
      loopCount: 0,
      frames: [
        { webpData: lossyWebp(Buffer.from([1, 2, 3, 4])), durationMs: 33 },
        { webpData: lossyWebp(Buffer.from([5, 6, 7, 8])), durationMs: 34 },
      ],
    });

    const chunks = parseWebp(out);
    expect(chunks.map((c) => c.fourCC)).toEqual(['VP8X', 'ANIM', 'ANMF', 'ANMF']);

    const vp8x = chunks[0].payload;
    expect(vp8x.length).toBe(10);
    expect(vp8x[0] & 0x02).toBe(0x02); // animation flag
    expect(vp8x[0] & 0x10).toBe(0); // no alpha
    expect(vp8x.readUIntLE(4, 3)).toBe(319); // canvas width - 1
    expect(vp8x.readUIntLE(7, 3)).toBe(239); // canvas height - 1

    const anim = chunks[1].payload;
    expect(anim.length).toBe(6);
    expect(anim.readUInt16LE(4)).toBe(0); // loop forever
  });

  it('encodes frame geometry, duration, flags, and preserves the bitstream', () => {
    const payload = Buffer.from([9, 9, 9, 9, 9]);
    const out = muxAnimatedWebp({
      width: 100,
      height: 50,
      loopCount: 3,
      frames: [{ webpData: lossyWebp(payload), durationMs: 125 }],
    });

    const chunks = parseWebp(out);
    expect(chunks[1].payload.readUInt16LE(4)).toBe(3); // loop count

    const anmf = chunks[2].payload;
    expect(anmf.readUIntLE(0, 3)).toBe(0); // x
    expect(anmf.readUIntLE(3, 3)).toBe(0); // y
    expect(anmf.readUIntLE(6, 3)).toBe(99); // width - 1
    expect(anmf.readUIntLE(9, 3)).toBe(49); // height - 1
    expect(anmf.readUIntLE(12, 3)).toBe(125); // duration ms
    expect(anmf[15]).toBe(0b10); // no blend, disposal none

    // Frame data after the 16-byte ANMF header is the VP8 chunk verbatim.
    const inner = parseChunks(out, out.indexOf(anmf) + 16, out.indexOf(anmf) + anmf.length);
    expect(inner).toHaveLength(1);
    expect(inner[0].fourCC).toBe('VP8 ');
    expect(inner[0].payload.equals(payload)).toBe(true);
  });

  it('carries ALPH chunks through from extended-layout frames and sets the alpha flag', () => {
    const alphPayload = Buffer.from([0xde, 0xad]);
    const vp8Payload = Buffer.from([1, 2, 3]);
    const extended = webpFile(
      chunk('VP8X', Buffer.concat([Buffer.from([0x10]), Buffer.alloc(9)])),
      chunk('ALPH', alphPayload),
      chunk('VP8 ', vp8Payload)
    );

    const out = muxAnimatedWebp({
      width: 8,
      height: 8,
      loopCount: 0,
      frames: [{ webpData: extended, durationMs: 40 }],
    });

    const chunks = parseWebp(out);
    expect(chunks[0].payload[0] & 0x10).toBe(0x10); // global alpha flag

    const anmf = chunks[2].payload;
    const inner = parseChunks(out, out.indexOf(anmf) + 16, out.indexOf(anmf) + anmf.length);
    expect(inner.map((c) => c.fourCC)).toEqual(['ALPH', 'VP8 ']);
    expect(inner[0].payload.equals(alphPayload)).toBe(true);
    // The frame's own VP8X must NOT be copied into the animation frame.
    expect(inner.some((c) => c.fourCC === 'VP8X')).toBe(false);
  });

  it('detects alpha from the VP8L lossless header bit', () => {
    const withAlpha = muxAnimatedWebp({
      width: 4,
      height: 4,
      loopCount: 0,
      frames: [{ webpData: webpFile(chunk('VP8L', vp8lPayload(true))), durationMs: 40 }],
    });
    expect(parseWebp(withAlpha)[0].payload[0] & 0x10).toBe(0x10);

    const noAlpha = muxAnimatedWebp({
      width: 4,
      height: 4,
      loopCount: 0,
      frames: [{ webpData: webpFile(chunk('VP8L', vp8lPayload(false))), durationMs: 40 }],
    });
    expect(parseWebp(noAlpha)[0].payload[0] & 0x10).toBe(0);
  });

  it('pads odd-sized payloads to even chunk boundaries', () => {
    // 5-byte VP8 payload → inner chunk padded; parseChunks asserts the
    // whole file walks cleanly, and RIFF size must include pad bytes.
    const out = muxAnimatedWebp({
      width: 2,
      height: 2,
      loopCount: 1,
      frames: [
        { webpData: lossyWebp(Buffer.from([1, 2, 3, 4, 5])), durationMs: 100 },
        { webpData: lossyWebp(Buffer.from([1])), durationMs: 100 },
      ],
    });
    parseWebp(out);
    expect(out.length % 2).toBe(0);
  });

  it('clamps out-of-range durations into the 24-bit field', () => {
    const out = muxAnimatedWebp({
      width: 2,
      height: 2,
      loopCount: 0,
      frames: [{ webpData: lossyWebp(Buffer.from([1, 2])), durationMs: 999_999_999 }],
    });
    expect(parseWebp(out)[2].payload.readUIntLE(12, 3)).toBe(0xffffff);
  });

  it('rejects empty input, bad headers, and frames without a bitstream', () => {
    const frame = { webpData: lossyWebp(Buffer.from([1])), durationMs: 40 };
    expect(() => muxAnimatedWebp({ width: 2, height: 2, loopCount: 0, frames: [] })).toThrow(/0 frames/);
    expect(() =>
      muxAnimatedWebp({
        width: 2,
        height: 2,
        loopCount: 0,
        frames: [{ webpData: Buffer.from('not a webp at all'), durationMs: 40 }],
      })
    ).toThrow(/RIFF/);
    expect(() =>
      muxAnimatedWebp({
        width: 2,
        height: 2,
        loopCount: 0,
        frames: [{ webpData: webpFile(chunk('ICCP', Buffer.from([1, 2]))), durationMs: 40 }],
      })
    ).toThrow(/bitstream/);
    expect(() => muxAnimatedWebp({ width: 0, height: 2, loopCount: 0, frames: [frame] })).toThrow(/dimensions/);
    expect(() => muxAnimatedWebp({ width: 2, height: 2, loopCount: -1, frames: [frame] })).toThrow(/loop/);
  });
});
