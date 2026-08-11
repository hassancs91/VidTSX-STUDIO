import { renderFrames } from '@remotion/renderer';
import type { CancelSignal } from '@remotion/renderer';
import type { VideoConfig } from 'remotion/no-react';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logEngine } from '../../../logging/log-engine';
import { getTempDir, ensureTempDir, getRemotionBinariesDir } from '../../utils/paths';
import { createWebpFrameEncoder } from './webp-frame-encoder';
import { muxAnimatedWebp, type AnimatedWebpFrame } from './animated-webp-mux';
import type { RenderGpuBackend } from '../../../shared/ipc/types';

const log = logEngine.createLogger('WebpRender');

export interface WebpRenderOptions {
  bundleUrl: string;
  compositionId: string;
  outputPath: string;
  /** Composition dimensions (pre-scale). */
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Chromium deviceScaleFactor — same semantics as renderMedia's scale. */
  scale: number;
  everyNthFrame: number;
  /** 0 = loop forever (WebP ANIM semantics). */
  loopCount: number;
  /** 1–100, higher is better; 100 encodes lossless. */
  quality: number;
  /** Keep the alpha channel instead of compositing onto white. */
  transparent: boolean;
  inputProps: Record<string, unknown>;
  concurrency: string | number | null;
  gpuBackend?: RenderGpuBackend;
  timeoutInMilliseconds: number;
  cancelSignal: CancelSignal;
}

export interface WebpRenderProgress {
  /** 'render' = Remotion producing PNG frames, 'encode' = WebP encode + mux. */
  stage: 'render' | 'encode';
  framesDone: number;
  totalFrames: number;
}

/**
 * Render a composition to an animated WebP.
 *
 * Remotion has no WebP codec and its bundled ffmpeg ships no WebP encoder,
 * so this pipeline renders a PNG frame sequence with renderFrames, encodes
 * each frame through Chromium's canvas WebP encoder (hidden window), and
 * muxes the frames into an animated WebP container. PNGs are deleted as
 * they're consumed; only the compressed WebP frames stay in memory.
 */
export async function renderAnimatedWebp(
  options: WebpRenderOptions,
  onProgress: (progress: WebpRenderProgress) => void
): Promise<void> {
  const totalFrames = Math.ceil(options.durationInFrames / options.everyNthFrame);

  await ensureTempDir();
  const framesDir = path.join(getTempDir(), `webp-frames-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(framesDir, { recursive: true });

  let cancelled = false;
  options.cancelSignal(() => {
    cancelled = true;
  });

  const composition: VideoConfig = {
    id: options.compositionId,
    width: options.width,
    height: options.height,
    fps: options.fps,
    durationInFrames: options.durationInFrames,
    defaultProps: {},
    props: options.inputProps,
    defaultCodec: null,
    defaultOutName: null,
    defaultVideoImageFormat: null,
    defaultPixelFormat: null,
    defaultProResProfile: null,
  };

  try {
    log.info('Rendering PNG frame sequence for WebP', {
      framesDir,
      totalFrames,
      scale: options.scale,
      quality: options.quality,
      transparent: options.transparent,
    });

    await renderFrames({
      serveUrl: options.bundleUrl,
      composition,
      outputDir: framesDir,
      imageFormat: 'png',
      inputProps: options.inputProps,
      everyNthFrame: options.everyNthFrame,
      scale: options.scale,
      muted: true,
      concurrency: options.concurrency,
      chromiumOptions: {
        disableWebSecurity: true,
        ...(options.gpuBackend ? { gl: options.gpuBackend } : {}),
      },
      timeoutInMilliseconds: options.timeoutInMilliseconds,
      cancelSignal: options.cancelSignal,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
      onStart: () => {},
      onFrameUpdate: (framesRendered) => {
        onProgress({ stage: 'render', framesDone: framesRendered, totalFrames });
      },
    });

    // Frame files are named element-<frameNumber>.png (padded). Sort by the
    // numeric frame index — with everyNthFrame > 1 the numbers are sparse.
    const frameFiles = (await fs.readdir(framesDir))
      .map((name) => {
        const match = /^element-(\d+)\.png$/.exec(name);
        return match ? { name, frame: parseInt(match[1], 10) } : null;
      })
      .filter((f): f is { name: string; frame: number } => f !== null)
      .sort((a, b) => a.frame - b.frame);

    if (frameFiles.length === 0) {
      throw new Error('renderFrames produced no PNG frames');
    }

    const encoder = await createWebpFrameEncoder({
      // Canvas quality is 0–1; exactly 1 = lossless VP8L.
      quality: Math.min(Math.max(options.quality, 1), 100) / 100,
      fillColor: options.transparent ? null : '#ffffff',
    });

    const webpFrames: AnimatedWebpFrame[] = [];
    try {
      for (let i = 0; i < frameFiles.length; i++) {
        if (cancelled) throw new Error('Render was cancelled');

        const { name, frame } = frameFiles[i];
        const nextFrame =
          i + 1 < frameFiles.length ? frameFiles[i + 1].frame : frame + options.everyNthFrame;
        // Cumulative rounding so display time never drifts from frame/fps time.
        const durationMs =
          Math.round((1000 * nextFrame) / options.fps) - Math.round((1000 * frame) / options.fps);

        const pngPath = path.join(framesDir, name);
        const png = await fs.readFile(pngPath);
        webpFrames.push({ webpData: await encoder.encode(png), durationMs });
        await fs.unlink(pngPath).catch(() => {});

        onProgress({ stage: 'encode', framesDone: i + 1, totalFrames: frameFiles.length });
      }
    } finally {
      encoder.destroy();
    }

    if (cancelled) throw new Error('Render was cancelled');

    // The canvas re-measures each frame, so trust the first encoded frame's
    // dimensions match the PNG sequence; the muxer stamps the canvas size.
    const outWidth = Math.round(options.width * options.scale);
    const outHeight = Math.round(options.height * options.scale);
    const fileBuffer = muxAnimatedWebp({
      width: outWidth,
      height: outHeight,
      loopCount: options.loopCount,
      frames: webpFrames,
    });

    await fs.writeFile(options.outputPath, fileBuffer);
    log.info('Animated WebP written', {
      outputPath: options.outputPath,
      frames: webpFrames.length,
      sizeBytes: fileBuffer.length,
    });
  } finally {
    await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {});
  }
}
