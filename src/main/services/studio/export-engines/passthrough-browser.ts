/**
 * A browser span for the passthrough engine (docs/export-engines-plan.md
 * Stage 2, conditions 2 + 4): the frames the browser must paint, rendered by
 * the same Remotion path the standard engine uses — same entry, same bundle,
 * same colour conversion (`colorSpace: 'bt709'` + the zscale tags) — but only
 * for the span's frame range, ONE FRAME EARLY (the first frame after a seek
 * shows the ceil source frame; the lead-in is dropped by the re-encode), video
 * only (the audio is the one pass), to a near-lossless x264 intermediate that
 * `passthrough-ffmpeg.ts` re-encodes with the copied spans' settings. Never
 * concatenated as-is (T1 leg 3: parameter sets and colour tags clash).
 */
import { cancelRender, renderComposition } from '../../remotion-renderer';
import type { ExportEngineInput } from './types';

/** Near-lossless: the intermediate exists only to be re-encoded once. */
const INTERMEDIATE_CRF = 10;

export interface BrowserSpanRender {
  /** First composition frame of the span proper. */
  from: number;
  frames: number;
  /** Frames rendered before `from` (0 at the composition start, else 1). */
  leadIn: number;
  outputPath: string;
  /** Distinct per span: the renderer keys cancellation by it. */
  jobId: string;
  onFrames: (rendered: number) => void;
}

export function renderBrowserSpan(input: ExportEngineInput, span: BrowserSpanRender): Promise<void> {
  const { entry, render } = input;
  return new Promise<void>((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error('Cancelled'));
      return;
    }
    const onAbort = () => cancelRender(span.jobId);
    input.signal.addEventListener('abort', onAbort, { once: true });
    void renderComposition(
      {
        bundleUrl: input.bundleUrl,
        compositionId: entry.compositionId,
        outputPath: span.outputPath,
        codec: 'h264',
        width: entry.width,
        height: entry.height,
        fps: entry.fps,
        durationInFrames: entry.durationInFrames,
        frameRange: [span.from - span.leadIn, span.from + span.frames - 1],
        crf: INTERMEDIATE_CRF,
        muted: true,
        cpuUsage: render.cpuUsage,
        gpuBackend: render.gpuBackend,
        // The intermediate must be x264 (deterministic, exact CRF); the GPU
        // encoder is used once, by our ffmpeg, for the final pieces.
        hardwareAcceleration: 'disable',
        timeoutInMilliseconds: render.timeoutInMilliseconds,
        colorSpace: input.color.matrix,
      },
      (progress) => span.onFrames(progress.framesRendered ?? 0),
      (complete) => {
        input.signal.removeEventListener('abort', onAbort);
        if (complete.success) resolve();
        else reject(new Error(complete.error ?? 'Browser span render failed'));
      },
      span.jobId,
    );
  });
}
