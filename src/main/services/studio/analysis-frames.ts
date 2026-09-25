// The analysis job's frame feed (docs/studio/FILTER_PACKS_DESIGN.md "Facts
// the build must carry" 1): the bundled Remotion ffmpeg over `image2pipe`.
// The stripped build has no `fps` filter, so the rate is fixed with the
// output option `-r`; and while it has no rawvideo MUXER, its rawvideo
// ENCODER rides `image2pipe` fine (verified 2026-09-24: 10 frames of 640×360
// came back as exactly 10 × 640 × 360 × 3 bytes), so frames arrive as raw
// RGB24 with nothing to decode — the harness's PNG route was only ever a way
// around the missing muxer. Frames are scaled to the analysis size (short
// side ≤ 512, even dimensions, computed here so the byte count per frame is
// known) and handed over one at a time with backpressure: ffmpeg's stdout is
// paused while a frame is being analysed.

import { spawn } from 'child_process';
import os from 'os';

/** The short side the analysis runs at (MODNet's reference rule; faces are fine at it). */
export const ANALYSIS_MAX_SHORT_SIDE = 512;

export interface FrameFeedOptions {
  ffmpeg: string;
  input: string;
  inputWidth: number;
  inputHeight: number;
  /** Source seconds to start at (an accurate seek — every proxy frame is a keyframe). */
  startSec: number;
  /** Seconds to read; null = to the end. Ignored for a still. */
  durationSec: number | null;
  /** Output frame rate: frame k is source `startSec + k / fps`. */
  fps: number;
  /** One frame from an image file. */
  still?: boolean;
  signal?: AbortSignal;
}

/** The analysis frame size for a source: short side capped, never upscaled, both sides even. */
export function analysisFrameSize(width: number, height: number, maxShort = ANALYSIS_MAX_SHORT_SIDE): { width: number; height: number } {
  const short = Math.min(width, height);
  const scale = short > maxShort ? maxShort / short : 1;
  const even = (v: number) => Math.max(2, Math.round((v * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

export function frameFeedArgs(options: FrameFeedOptions, size: { width: number; height: number }): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    ...(options.still || options.startSec <= 0 ? [] : ['-ss', String(options.startSec)]),
    '-i',
    options.input,
    ...(options.still ? ['-frames:v', '1'] : []),
    ...(!options.still && options.durationSec !== null ? ['-t', String(options.durationSec)] : []),
    '-map',
    '0:v:0',
    ...(options.still ? [] : ['-r', String(options.fps)]),
    '-vf',
    `scale=${size.width}:${size.height}`,
    '-pix_fmt',
    'rgb24',
    '-f',
    'image2pipe',
    '-c:v',
    'rawvideo',
    'pipe:1',
  ];
}

/**
 * Stream the frames of a span as raw RGB24, calling `onFrame` for each in
 * order and waiting for it before reading on. Resolves to the frame count.
 */
export async function streamAnalysisFrames(
  options: FrameFeedOptions,
  onFrame: (rgb: Uint8Array, index: number, size: { width: number; height: number }) => Promise<void>,
): Promise<number> {
  const size = analysisFrameSize(options.inputWidth, options.inputHeight);
  const frameBytes = size.width * size.height * 3;
  const args = frameFeedArgs(options, size);

  return new Promise<number>((resolve, reject) => {
    const proc = spawn(options.ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    if (proc.pid !== undefined) {
      try {
        os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {
        // Not fatal: the decode just runs at normal priority.
      }
    }
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });

    let frame = Buffer.allocUnsafe(frameBytes);
    let filled = 0;
    let index = 0;
    let busy = false;
    let closed = false;
    let failed: Error | null = null;
    const queue: Buffer[] = [];

    const finish = () => {
      if (failed) reject(failed);
      else resolve(index);
    };
    const fail = (err: Error) => {
      if (!failed) failed = err;
      queue.length = 0;
      if (!closed) proc.kill();
    };

    // Frames are handed over strictly one at a time; ffmpeg waits on its pipe
    // (paused stdout) while a frame is being analysed.
    const drain = async () => {
      if (busy) return;
      busy = true;
      while (queue.length > 0 && !failed) {
        const rgb = queue.shift()!;
        try {
          await onFrame(new Uint8Array(rgb.buffer, rgb.byteOffset, rgb.length), index++, size);
        } catch (err) {
          fail(err instanceof Error ? err : new Error(String(err)));
        }
      }
      busy = false;
      if (queue.length === 0 && !failed) proc.stdout.resume();
      if (closed && queue.length === 0) finish();
    };

    proc.stdout.on('data', (chunk: Buffer) => {
      let offset = 0;
      while (offset < chunk.length) {
        const take = Math.min(frameBytes - filled, chunk.length - offset);
        chunk.copy(frame, filled, offset, offset + take);
        filled += take;
        offset += take;
        if (filled === frameBytes) {
          queue.push(frame);
          frame = Buffer.allocUnsafe(frameBytes);
          filled = 0;
        }
      }
      if (queue.length > 0) {
        proc.stdout.pause();
        void drain();
      }
    });

    const onAbort = () => fail(new Error('Cancelled'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    proc.on('error', (err) => {
      options.signal?.removeEventListener('abort', onAbort);
      fail(err);
    });
    proc.on('close', (code) => {
      options.signal?.removeEventListener('abort', onAbort);
      closed = true;
      if (options.signal?.aborted) failed = failed ?? new Error('Cancelled');
      else if (code !== 0 && !failed) failed = new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`);
      else if (filled !== 0 && !failed) failed = new Error(`ffmpeg ended mid-frame (${filled} of ${frameBytes} bytes)`);
      if (!busy && queue.length === 0) finish();
      else if (!busy) void drain();
    });
  });
}
