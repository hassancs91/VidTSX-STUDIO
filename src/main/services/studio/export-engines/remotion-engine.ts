/**
 * Engine 1 — today's Remotion frame-by-frame path (docs/export-engines-plan.md
 * D1), moved behind the seam with its behaviour intact: the same
 * `renderComposition` the render queue always used, same codec, CRF, preset,
 * concurrency and GPU options, one browser walk. Two differences, both owned
 * by the finishing stage's contract (D7):
 *
 * - the frames are encoded to the shared colour policy (`colorSpace: 'bt709'`
 *   plus the primaries/transfer tags Remotion leaves unknown → `yuv420p tv
 *   bt709`) instead of Remotion's default `yuvj420p pc bt470bg`;
 * - the audio Remotion mixes in the same pass is kept as PCM (`.mkv`), so the
 *   only AAC encode happens in the finishing stage with its delay recorded —
 *   Remotion's own path compresses to raw ADTS and stream-copies it, which is
 *   the +42.7 ms T1 measured on every export (D6).
 *
 * Why not video-only + a separate audio pass: a second browser walk makes
 * Remotion download every source again (7 min for a 1.3 GB clip against
 * 8.6 min of frames, measured 2026-09-05).
 */
import path from 'path';
import { cancelRender, renderComposition } from '../../remotion-renderer';
import type { ExportEngine, ExportEngineInput, ExportEngineProduct } from './types';

export const remotionExportEngine: ExportEngine = {
  id: 'remotion',

  async availability() {
    return { available: true };
  },

  async produce(input: ExportEngineInput): Promise<ExportEngineProduct> {
    const videoPath = path.join(input.workDir, 'video.mkv');
    await renderWithRemotion(input, videoPath);
    return { videoPath, audioPath: videoPath };
  },
};

/** Wrap the callback-style renderer into one awaitable, cancellable render. */
function renderWithRemotion(input: ExportEngineInput, outputPath: string): Promise<void> {
  const { entry, render } = input;
  return new Promise<void>((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error('Cancelled'));
      return;
    }
    const onAbort = () => cancelRender(input.jobId);
    input.signal.addEventListener('abort', onAbort, { once: true });

    void renderComposition(
      {
        bundleUrl: input.bundleUrl,
        compositionId: entry.compositionId,
        outputPath,
        codec: 'h264',
        width: entry.width,
        height: entry.height,
        fps: entry.fps,
        durationInFrames: entry.durationInFrames,
        crf: render.crf,
        // The composition keeps its size; only the output is scaled (the
        // renderer snaps to even dims — `resolveRenderScale`).
        scale: render.scale,
        muted: false,
        audioCodec: 'pcm-16',
        cpuUsage: render.cpuUsage,
        gpuBackend: render.gpuBackend,
        hardwareAcceleration: render.hardwareAcceleration,
        timeoutInMilliseconds: render.timeoutInMilliseconds,
        colorSpace: input.color.matrix,
      },
      (progress) => {
        input.onProgress({
          framesDone: progress.framesRendered ?? 0,
          totalFrames: progress.totalFrames ?? entry.durationInFrames,
        });
      },
      (complete) => {
        input.signal.removeEventListener('abort', onAbort);
        if (complete.success) resolve();
        else reject(new Error(complete.error ?? 'Render failed'));
      },
      input.jobId,
      input.onEncoderResolved,
    );
  });
}
