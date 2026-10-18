// The in-order render (P2 part 3, purity_check): a prepared build's frames
// 0..N in ONE page, the way the preview plays them, kept only where asked.
// Moved out of build-stills.ts (P4 part 2) to keep that file in size.

import fs from 'fs/promises';
import { makeCancelSignal, renderFrames } from '@remotion/renderer';
import { getRemotionBinariesDir } from '../../utils/paths';
import { clampFrames, framePath, STILL_TIMEOUT_MS, type PreparedBuild } from './build-stills';

/**
 * Render frames 0..max(keep) IN ORDER in ONE page (renderFrames, concurrency 1:
 * the way the preview plays them) and save only `keep` as PNGs at `scale`.
 */
export async function renderPreparedInOrder(
  prepared: PreparedBuild,
  outDir: string,
  keep: number[],
  options: { label: string; scale?: number; signal?: AbortSignal },
): Promise<{ frames: Array<{ frame: number; path: string }>; rendered: number }> {
  const { signal } = options;
  const wanted = clampFrames(keep, prepared.composition.durationInFrames);
  const last = wanted[wanted.length - 1] ?? 0;
  const buffers = new Map<number, Buffer>();
  const { cancel, cancelSignal } = makeCancelSignal();
  signal?.addEventListener('abort', cancel, { once: true });
  let rendered = 0;
  try {
    signal?.throwIfAborted();
    await renderFrames({
      composition: prepared.composition,
      serveUrl: prepared.serveUrl,
      inputProps: prepared.inputProps,
      outputDir: null,
      frameRange: [0, last],
      concurrency: 1,
      imageFormat: 'png',
      ...(options.scale ? { scale: options.scale } : {}),
      onStart: () => {},
      onFrameUpdate: (count) => {
        rendered = count;
      },
      onFrameBuffer: (buffer, frame) => {
        if (wanted.includes(frame)) buffers.set(frame, buffer);
      },
      chromiumOptions: { disableWebSecurity: true, gl: prepared.gl },
      timeoutInMilliseconds: STILL_TIMEOUT_MS,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
      cancelSignal,
    });
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  const frames: Array<{ frame: number; path: string }> = [];
  for (const frame of wanted) {
    const buffer = buffers.get(frame);
    if (!buffer) throw new Error(`The in-order render did not return frame ${frame}.`);
    const output = framePath(outDir, options.label, frame, 'png');
    await fs.writeFile(output, buffer);
    frames.push({ frame, path: output });
  }
  return { frames, rendered };
}
