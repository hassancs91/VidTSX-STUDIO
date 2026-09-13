/**
 * The shot layer of a composite span (docs/export-engines-plan.md "Engine 3"):
 * the same entry and bundle every export renders, asked — through the
 * `layer: 'shots'` input prop the generated entry forwards to
 * `TimelineComposition` — to paint only the overlay and caption lanes'
 * graphics over a transparent background. Rendered for the span's frames
 * only, one frame early (condition 4, the lead-in dropped by the composite),
 * as ProRes 4444 with alpha (PNG screenshots, `yuva444p10le`): the format the
 * editor's own bake composites from. No colour conversion is asked of
 * Remotion here — the layer is RGBA graphics, converted once, by the
 * composite's zscale, together with the footage it lands on.
 *
 * Footage never mounts in this render, so the compositor opens no source
 * file: a shot's frames cost what the shot's graphics cost, not a 4K decode.
 */
import fs from 'fs/promises';
import path from 'path';
import { cancelRender, renderComposition } from '../../remotion-renderer';
import type { CompositeSpan, ExportSpan } from '../../../../shared/studio/export-spans';
import type { ExportEngineInput } from './types';

/** Gap (in frames) between two composite spans below which one layer render spans both — see `ShotLayerRuns.runEnd`. */
export const LAYER_MERGE_GAP_FRAMES = 30;

export interface ShotLayerRender {
  /** First composition frame of the span proper. */
  from: number;
  frames: number;
  /** Frames rendered before `from` (0 at the composition start, else 1). */
  leadIn: number;
  /** Must end in `.mov` (ProRes). */
  outputPath: string;
  /** Distinct per span: the renderer keys cancellation by it. */
  jobId: string;
  onFrames: (rendered: number) => void;
}

export function renderShotLayerSpan(input: ExportEngineInput, span: ShotLayerRender): Promise<void> {
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
        codec: 'prores',
        transparent: true,
        inputProps: { layer: 'shots' },
        width: entry.width,
        height: entry.height,
        fps: entry.fps,
        durationInFrames: entry.durationInFrames,
        frameRange: [span.from - span.leadIn, span.from + span.frames - 1],
        // Same output size as the pieces (`exportOutputSize`): the renderer
        // resolves this scale through the same shared rule.
        scale: render.scale,
        muted: true,
        cpuUsage: render.cpuUsage,
        gpuBackend: render.gpuBackend,
        hardwareAcceleration: 'disable',
        timeoutInMilliseconds: render.timeoutInMilliseconds,
      },
      (progress) => span.onFrames(progress.framesRendered ?? 0),
      (complete) => {
        input.signal.removeEventListener('abort', onAbort);
        if (complete.success) resolve();
        else reject(new Error(complete.error ?? 'Shot layer render failed'));
      },
      span.jobId,
    );
  });
}

/**
 * One layer render per RUN of composite spans (measured 2026-09-12 on
 * `video-10-test`: every layer render pays a few seconds of Remotion start,
 * 48 composite spans in the plan): the layer is continuous across the run — only the
 * footage underneath changes from span to span — so it is rendered once, one
 * frame early, and each span of the run reads its own window of the file
 * (`trimStart` = the lead-in plus the span's offset into the run). The file
 * is removed after the run's last span; a span demoted to the browser inside
 * the run leaves the others their windows.
 */
export interface RunLayer {
  path: string;
  /** `trim=start_frame` for the span: the run's lead-in plus the span's offset into the run. */
  trimStart: number;
}

/**
 * Pure: last frame (exclusive) of the layer render starting at composite span
 * `index`. Every later composite span joins it as long as the gap of other
 * spans between them is under `LAYER_MERGE_GAP_FRAMES` — the layer over the
 * gap is rendered and thrown away, which is cheaper than one more start
 * (measured 2026-09-12 on video-10-test at 1080p, graphics only: ~1.4 s to
 * the first frame plus the browser launch, then ~9 frames/s — break-even
 * ≈ 15–30 frames).
 */
export function layerRunEnd(spans: ReadonlyArray<ExportSpan>, index: number): number {
  let end = spans[index].from + spans[index].frames;
  let gap = 0;
  for (let j = index + 1; j < spans.length; j++) {
    const s = spans[j];
    if (s.kind === 'composite') {
      end = s.from + s.frames;
      gap = 0;
      continue;
    }
    gap += s.frames;
    if (gap >= LAYER_MERGE_GAP_FRAMES) break;
  }
  return end;
}

export class ShotLayerRuns {
  private current: { from: number; to: number; path: string; leadIn: number } | null = null;

  constructor(private readonly input: ExportEngineInput, private readonly spans: ReadonlyArray<ExportSpan>) {}

  /** The layer window for composite span `index`, rendering the run it starts when none is open. */
  async layerFor(index: number, span: CompositeSpan, onFrames: (rendered: number) => void): Promise<RunLayer> {
    if (!this.current || span.from < this.current.from || span.from + span.frames > this.current.to) {
      await this.release();
      const to = this.runEnd(index);
      const leadIn = Math.min(1, span.from);
      const layerPath = path.join(this.input.workDir, `layer-${String(index).padStart(4, '0')}.mov`);
      await renderShotLayerSpan(this.input, {
        from: span.from,
        frames: to - span.from,
        leadIn,
        outputPath: layerPath,
        jobId: `${this.input.jobId}:layer${index}`,
        onFrames,
      });
      this.current = { from: span.from, to, path: layerPath, leadIn };
    }
    return { path: this.current.path, trimStart: this.current.leadIn + (span.from - this.current.from) };
  }

  private runEnd(index: number): number {
    return layerRunEnd(this.spans, index);
  }

  /** Drop the open run's file once the plan has moved past it. */
  async releaseIfPast(nextFrom: number): Promise<void> {
    if (this.current && nextFrom >= this.current.to) await this.release();
  }

  async release(): Promise<void> {
    if (!this.current) return;
    const { path: file } = this.current;
    this.current = null;
    await fs.rm(file, { force: true }).catch(() => {});
  }
}
