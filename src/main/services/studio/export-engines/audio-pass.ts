/**
 * The one audio pass over the whole timeline (docs/export-engines-plan.md
 * D6/D7). Remotion mixes the composition's audio exactly as the preview
 * plays it — every clip's trim, gain, fades and speed — so the finishing
 * stage asks Remotion for the audio ALONE: an audio-only render skips the
 * screenshots and, because `<OffthreadVideo>` fetches no frame when video is
 * disabled, the compositor never decodes a source frame; the browser only
 * seeks the DOM through the timeline to collect the audio assets.
 *
 * The result is PCM (Remotion's merged WAV copied out untouched), so the
 * only AAC encode happens in the mux, where ffmpeg records the encoder delay
 * in the container. That is what corrects the +42.7 ms T1 measured: Remotion
 * compresses to raw ADTS and stream-copies it into the mp4, which loses the
 * 2048-sample priming and leaves every export's audio late by exactly that.
 */
import { makeCancelSignal, renderMedia } from '@remotion/renderer';
import { getRemotionBinariesDir } from '../../../utils/paths';
import type { StudioExportEntry } from '../export-entry';
import type { ExportRenderSettings } from './types';

export interface AudioPassOptions {
  bundleUrl: string;
  entry: StudioExportEntry;
  /** Must end in .wav — Remotion derives the container from it. */
  outputPath: string;
  render: ExportRenderSettings;
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}

export async function renderTimelineAudio(options: AudioPassOptions): Promise<void> {
  const { entry } = options;
  const { cancel, cancelSignal } = makeCancelSignal();
  const onAbort = () => cancel();
  if (options.signal.aborted) throw new Error('Cancelled');
  options.signal.addEventListener('abort', onAbort, { once: true });
  try {
    await renderMedia({
      serveUrl: options.bundleUrl,
      composition: {
        id: entry.compositionId,
        width: entry.width,
        height: entry.height,
        fps: entry.fps,
        durationInFrames: entry.durationInFrames,
        defaultProps: {},
        props: {},
        defaultCodec: null,
        defaultOutName: null,
        defaultVideoImageFormat: null,
        defaultPixelFormat: null,
        defaultProResProfile: null,
      },
      inputProps: {},
      outputLocation: options.outputPath,
      codec: 'wav',
      ...(options.render.cpuUsage ? { concurrency: options.render.cpuUsage } : {}),
      chromiumOptions: { disableWebSecurity: true },
      timeoutInMilliseconds: options.render.timeoutInMilliseconds,
      cancelSignal,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
      onProgress: ({ progress }) => options.onProgress(progress),
    });
  } finally {
    options.signal.removeEventListener('abort', onAbort);
  }
  if (options.signal.aborted) throw new Error('Cancelled');
}
