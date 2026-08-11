// Pure animated-WebP muxer — no Electron imports so it stays unit-testable
// (same rule as whisper-output.ts). Takes complete single-image WebP files
// (as produced by Chromium's canvas encoder) and assembles them into one
// animated WebP: RIFF("WEBP") → VP8X (anim+alpha flags) → ANIM → ANMF per
// frame, per https://developers.google.com/speed/webp/docs/riff_container.
//
// The frame payloads are repackaged verbatim (ALPH/VP8/VP8L chunks copied
// bit-for-bit), so muxing is lossless and fast — all pixel encoding already
// happened in the canvas.

export interface AnimatedWebpFrame {
  /** A complete single-image .webp file (simple or extended layout). */
  webpData: Buffer;
  /** How long this frame is displayed, in milliseconds (24-bit range). */
  durationMs: number;
}

export interface AnimatedWebpOptions {
  /** Canvas size — every frame must have been encoded at exactly this size. */
  width: number;
  height: number;
  /** 0 = loop forever, N = play N times (16-bit range). */
  loopCount: number;
  frames: AnimatedWebpFrame[];
}

function u16le(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u24le(n: number): Buffer {
  const b = Buffer.alloc(3);
  b.writeUIntLE(n, 0, 3);
  return b;
}

function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

/** RIFF chunk: fourCC + LE size + payload + zero pad byte if payload is odd. */
function chunk(fourCC: string, payload: Buffer): Buffer {
  const parts = [Buffer.from(fourCC, 'ascii'), u32le(payload.length), payload];
  if (payload.length % 2 === 1) parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

interface ExtractedImage {
  /** ALPH? + (VP8 | VP8L) chunks, headers included, in spec order. */
  imageChunks: Buffer;
  hasAlpha: boolean;
}

/**
 * Pull the image-data chunks out of a standalone WebP file. Handles all three
 * layouts Chromium emits: simple lossy (VP8), simple lossless (VP8L, alpha
 * embedded in the bitstream), and extended (VP8X + optional ALPH + VP8).
 * Metadata chunks (ICCP/EXIF/XMP) are dropped — invalid inside ANMF.
 */
function extractImageChunks(webpFile: Buffer): ExtractedImage {
  if (
    webpFile.length < 12 ||
    webpFile.toString('ascii', 0, 4) !== 'RIFF' ||
    webpFile.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Frame is not a WebP file (missing RIFF/WEBP header)');
  }

  let alph: Buffer | null = null;
  let bitstream: Buffer | null = null;
  let vp8xAlphaFlag = false;
  let vp8lAlphaBit = false;

  let offset = 12;
  while (offset + 8 <= webpFile.length) {
    const fourCC = webpFile.toString('ascii', offset, offset + 4);
    const size = webpFile.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > webpFile.length) {
      throw new Error(`Truncated WebP chunk "${fourCC}"`);
    }
    // Re-chunk instead of slicing the source bytes: guarantees the odd-size
    // pad byte is present even if the source file omitted a trailing pad.
    const rechunked = () => chunk(fourCC, webpFile.subarray(payloadStart, payloadEnd));

    if (fourCC === 'VP8 ' || fourCC === 'VP8L') {
      bitstream = rechunked();
      if (fourCC === 'VP8L' && size >= 5) {
        // VP8L header: 1 signature byte (0x2F), then a LE uint32 packed as
        // 14-bit width-1, 14-bit height-1, 1-bit alpha_is_used, 3-bit version.
        vp8lAlphaBit = ((webpFile.readUInt32LE(payloadStart + 1) >>> 28) & 1) === 1;
      }
    } else if (fourCC === 'ALPH') {
      alph = rechunked();
    } else if (fourCC === 'VP8X' && size >= 1) {
      vp8xAlphaFlag = (webpFile[payloadStart] & 0x10) !== 0;
    }

    offset = payloadEnd + (size % 2); // skip pad byte
  }

  if (!bitstream) {
    throw new Error('WebP frame contains no VP8/VP8L bitstream');
  }

  const imageChunks = alph ? Buffer.concat([alph, bitstream]) : bitstream;
  return {
    imageChunks,
    hasAlpha: alph !== null || vp8lAlphaBit || vp8xAlphaFlag,
  };
}

/**
 * Assemble single-image WebP frames into one animated WebP file.
 *
 * Every frame covers the full canvas at (0,0) with disposal "none" and
 * blending "no blend" (each frame replaces the previous one) — correct for
 * screen-recorded/rendered sequences where frames are complete pictures.
 */
export function muxAnimatedWebp(options: AnimatedWebpOptions): Buffer {
  const { width, height, loopCount, frames } = options;
  if (frames.length === 0) throw new Error('Cannot mux an animated WebP with 0 frames');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 0x1000000 || height > 0x1000000) {
    throw new Error(`Invalid canvas dimensions ${width}x${height}`);
  }
  if (!Number.isInteger(loopCount) || loopCount < 0 || loopCount > 0xffff) {
    throw new Error(`Invalid loop count ${loopCount}`);
  }

  let anyAlpha = false;
  const anmfChunks: Buffer[] = [];

  for (const frame of frames) {
    const { imageChunks, hasAlpha } = extractImageChunks(frame.webpData);
    anyAlpha = anyAlpha || hasAlpha;

    const duration = Math.min(Math.max(Math.round(frame.durationMs), 0), 0xffffff);
    const anmfHeader = Buffer.concat([
      u24le(0), // frame X / 2
      u24le(0), // frame Y / 2
      u24le(width - 1),
      u24le(height - 1),
      u24le(duration),
      Buffer.from([0b10]), // bit1 = do not blend, bit0 = disposal none
    ]);
    anmfChunks.push(chunk('ANMF', Buffer.concat([anmfHeader, imageChunks])));
  }

  const vp8x = chunk(
    'VP8X',
    Buffer.concat([
      Buffer.from([0x02 | (anyAlpha ? 0x10 : 0)]), // flags: animation (+ alpha)
      Buffer.alloc(3), // reserved
      u24le(width - 1),
      u24le(height - 1),
    ])
  );

  const anim = chunk(
    'ANIM',
    Buffer.concat([
      u32le(0), // background color (BGRA) — transparent; ignored with no-blend frames
      u16le(loopCount),
    ])
  );

  const body = Buffer.concat([vp8x, anim, ...anmfChunks]);
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    u32le(4 + body.length), // "WEBP" + chunks
    Buffer.from('WEBP', 'ascii'),
    body,
  ]);
}
