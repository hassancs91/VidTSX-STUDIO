// A Remotion render driven from MAIN (W8 Stage 3): bundle a TSX entry, then
// `renderComposition` to H.264 — the same two services the render queue's
// handler calls, minus the renderer-owned queue row. The flow runner needs
// this because a run lives in main and cannot enqueue into the renderer's
// queue (agents plan §1.5); `caption_video` needs it because the bundled
// ffmpeg has no `subtitles` / `drawtext` filter, so burn-in is the caption
// composition rendered over the clip. Settings supply the timeout, GPU
// backend and hardware-acceleration defaults exactly as the handler does.
// The active render is registered in `getActiveJobs()` under its job id, so
// a cancel goes through `cancelRender` like every other render in the app.

import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { bundleComposition } from '../remotion-bundler';
import { cancelRender, renderComposition } from '../remotion-renderer';
import { getRenderDefaultGpuBackend, getRenderDefaultHardwareAcceleration, getRenderTimeoutSeconds } from '../settings';

export type RenderPhase = 'bundling' | 'rendering';

export interface RenderTsxOptions {
  /** The TSX file (a composition component) or a `registerRoot()` entry. */
  entryPath: string;
  /** True for a self-registering entry (the caption composition). */
  skipWrapper?: boolean;
  /** The composition id inside the bundle; the bundle's first one when absent. */
  compositionId?: string;
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
  durationInFrames?: number;
  signal?: AbortSignal;
  onProgress?: (phase: RenderPhase, percent: number) => void;
  /** Fixed job id, so a caller can name the render before it starts. */
  jobId?: string;
}

export interface RenderTsxResult {
  outputPath: string;
  fileSize: number;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface RemotionRenderDeps {
  render(opts: RenderTsxOptions): Promise<RenderTsxResult>;
}

async function renderReal(opts: RenderTsxOptions): Promise<RenderTsxResult> {
  if (opts.signal?.aborted) throw new Error('Cancelled.');
  const bundle = await bundleComposition(opts.entryPath, {
    ...(opts.skipWrapper ? { skipWrapper: true } : {}),
    onProgress: (fraction) => opts.onProgress?.('bundling', Math.round(fraction * 100)),
  });
  if (!bundle.success || !bundle.serveUrl) throw new Error(bundle.error || 'Bundling failed.');
  if (opts.signal?.aborted) throw new Error('Cancelled.');

  const matched = opts.compositionId
    ? bundle.compositions?.find((c) => c.id === opts.compositionId)
    : bundle.compositions?.[0];
  const compositionId = opts.compositionId ?? matched?.id;
  if (!compositionId) throw new Error('The bundle registered no composition.');
  const width = opts.width ?? matched?.width ?? 1920;
  const height = opts.height ?? matched?.height ?? 1080;
  const fps = opts.fps ?? matched?.fps ?? 30;
  const durationInFrames = opts.durationInFrames ?? matched?.durationInFrames;

  const [timeoutSeconds, gpuBackend, hardwareAcceleration] = await Promise.all([
    getRenderTimeoutSeconds(),
    getRenderDefaultGpuBackend(),
    getRenderDefaultHardwareAcceleration(),
  ]);
  const jobId = opts.jobId ?? randomUUID();

  const done = new Promise<void>((resolve, reject) => {
    const onAbort = () => cancelRender(jobId);
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    void renderComposition(
      {
        bundleUrl: bundle.serveUrl as string,
        compositionId,
        outputPath: opts.outputPath,
        codec: 'h264',
        width,
        height,
        fps,
        ...(durationInFrames !== undefined ? { durationInFrames } : {}),
        gpuBackend,
        hardwareAcceleration,
        timeoutInMilliseconds: timeoutSeconds * 1000,
      },
      (progress) => opts.onProgress?.('rendering', progress.percent),
      (complete) => {
        opts.signal?.removeEventListener('abort', onAbort);
        if (complete.success) resolve();
        else reject(new Error(opts.signal?.aborted ? 'Cancelled.' : complete.error || 'The render failed.'));
      },
      jobId,
    ).catch((err: unknown) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
  await done;
  const stat = await fs.stat(opts.outputPath);
  return { outputPath: opts.outputPath, fileSize: stat.size, width, height, fps, durationInFrames: durationInFrames ?? 0 };
}

let deps: RemotionRenderDeps = { render: renderReal };

/** Test seam: replace the bundle + render pair with a fake that writes the file. */
export function setRemotionRenderDepsForTests(next: RemotionRenderDeps | null): void {
  deps = next ?? { render: renderReal };
}

/** Bundle and render one TSX entry to an MP4 at `outputPath`. */
export function renderTsxToMp4(opts: RenderTsxOptions): Promise<RenderTsxResult> {
  return deps.render(opts);
}
