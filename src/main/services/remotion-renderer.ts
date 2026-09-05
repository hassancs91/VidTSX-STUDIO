import { renderMedia, makeCancelSignal, selectComposition } from '@remotion/renderer';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { getRemotionBinariesDir } from '../utils/paths';
import { snapRenderScale } from '../../shared/render-scale';
import { renderAnimatedWebp } from './webp/webp-render';
import { withBt709FilterTags } from './remotion-color-args';
import type {
  RenderCodec,
  RenderGpuBackend,
  RenderHardwareAcceleration,
  RenderJob,
  RenderJobStatus,
  RenderProgressEvent,
  RenderCompleteEvent,
} from '../../shared/ipc/types';

export interface RenderOptions {
  bundleUrl: string;
  compositionId: string;
  outputPath: string;
  codec: RenderCodec;
  width: number;
  height: number;
  fps: number;
  crf?: number;
  muted?: boolean;
  scale?: number;
  everyNthFrame?: number;
  numberOfGifLoops?: number | null;
  inputProps?: Record<string, unknown>;
  durationInFrames?: number;
  transparent?: boolean;
  // Caps how many Chromium tabs Remotion spawns to render frames in parallel.
  // Passed verbatim to renderMedia({ concurrency }) — null/undefined = Remotion default (all cores).
  cpuUsage?: string | null;
  // Chromium GL backend — passed to renderMedia's chromiumOptions.gl. Software
  // backends (swangle, swiftshader) work everywhere; GPU backends (angle,
  // angle-egl, egl, vulkan) need compatible drivers and may crash on some
  // machines. undefined = Remotion default (swangle).
  gpuBackend?: RenderGpuBackend;
  // Routes video encoding to the GPU's dedicated encoder (NVENC/QSV/AMF/
  // VideoToolbox) when available. 'if-possible' silently falls back to CPU.
  // undefined = disable (status-quo CPU encoding).
  hardwareAcceleration?: RenderHardwareAcceleration;
  // Per-frame timeout passed to Remotion. undefined = use DEFAULT_RENDER_TIMEOUT_MS.
  timeoutInMilliseconds?: number;
  // Remotion's colorSpace: 'bt709' converts the frames to limited-range
  // BT.709 and tags them (yuv420p tv bt709) — the Studio export engines'
  // shared colour policy. undefined = Remotion default (yuvj420p pc bt470bg,
  // what every non-Studio render has always produced).
  colorSpace?: 'bt709';
  // Audio track codec. 'pcm-16' keeps Remotion's mixed WAV as-is (the output
  // must be .mkv for h264) — the Studio export engines take it that way so the
  // only AAC encode happens in their finishing stage, with the encoder delay
  // recorded. undefined = Remotion default (AAC via raw ADTS, stream-copied).
  audioCodec?: 'pcm-16';
}

const DEFAULT_RENDER_TIMEOUT_MS = 600_000;

interface ActiveRender {
  jobId: string;
  compositionId: string;
  outputPath: string;
  status: RenderJobStatus;
  progress: number;
  cancel: () => void;
  error?: string;
}

// Active render jobs
const activeRenders = new Map<string, ActiveRender>();

// Map our codec types to Remotion codec types. 'webp' never reaches this —
// it branches into the frame-sequence pipeline before renderMedia is called.
function mapCodec(codec: RenderCodec): 'h264' | 'h265' | 'vp8' | 'vp9' | 'gif' | 'prores' {
  if (codec === 'webp') {
    throw new Error('webp renders do not go through renderMedia');
  }
  return codec;
}

export interface EncoderResolvedInfo {
  encoderName: string;
  hardwareAccelerated: boolean;
}

// Patterns that signal a hardware-accelerated ffmpeg video encoder. Covers
// NVIDIA (nvenc), Intel Quick Sync (qsv), AMD (amf), Apple (videotoolbox),
// and generic vaapi/v4l2 paths on Linux. Falls back to 'CPU' for libx264/
// libx265/etc.
const HARDWARE_ENCODER_PATTERNS = [
  /_nvenc$/i,
  /_qsv$/i,
  /_amf$/i,
  /_videotoolbox$/i,
  /_vaapi$/i,
  /_v4l2m2m$/i,
];

function isHardwareEncoder(name: string): boolean {
  return HARDWARE_ENCODER_PATTERNS.some((re) => re.test(name));
}

// Walk the ffmpeg args list and return the value after the last `-c:v` /
// `-codec:v` / `-vcodec` flag. Returns null when no video codec is specified
// (e.g. some GIF or audio-only paths).
function extractVideoEncoder(args: readonly string[]): string | null {
  const videoCodecFlags = new Set(['-c:v', '-codec:v', '-vcodec']);
  let last: string | null = null;
  for (let i = 0; i < args.length - 1; i++) {
    if (videoCodecFlags.has(args[i])) {
      last = args[i + 1];
    }
  }
  return last;
}

export async function renderComposition(
  options: RenderOptions,
  onProgress: (event: RenderProgressEvent) => void,
  onComplete: (event: RenderCompleteEvent) => void,
  externalJobId?: string,
  onEncoderResolved?: (info: EncoderResolvedInfo) => void
): Promise<string> {
  const jobId = externalJobId ?? randomUUID();

  // Create cancel signal
  const { cancel, cancelSignal } = makeCancelSignal();

  // Register active render
  const activeRender: ActiveRender = {
    jobId,
    compositionId: options.compositionId,
    outputPath: options.outputPath,
    status: 'rendering',
    progress: 0,
    cancel,
  };
  activeRenders.set(jobId, activeRender);

  const resolveAndRender = async () => {
    let width = options.width;
    let height = options.height;
    let fps = options.fps;
    let totalFrames: number;

    // Per-frame timeout. Remotion's default (30s) is too tight for heavy WebGL/Three.js
    // scenes with large instanced geometry or shaders — they routinely need multiple
    // seconds per frame and spike on first compilation. User-configurable via
    // Settings > General; defaults to 600s.
    const PER_FRAME_TIMEOUT_MS = options.timeoutInMilliseconds ?? DEFAULT_RENDER_TIMEOUT_MS;

    if (options.durationInFrames !== undefined) {
      totalFrames = options.durationInFrames;
    } else {
      const comp = await selectComposition({
        serveUrl: options.bundleUrl,
        id: options.compositionId,
        inputProps: options.inputProps ?? {},
        chromiumOptions: { disableWebSecurity: true },
        timeoutInMilliseconds: PER_FRAME_TIMEOUT_MS,
        binariesDirectory: getRemotionBinariesDir() ?? undefined,
      });
      width = comp.width;
      height = comp.height;
      fps = comp.fps;
      totalFrames = comp.durationInFrames;
    }

    // Alpha channel needs codec-specific pixel formats: yuva420p for VP8/VP9, yuva444p10le for ProRes.
    // PNG image format is required for any alpha render so frames carry the alpha channel.
    // Ignore the flag for non-alpha codecs so a stale persisted-queue entry can't break them.
    const isProRes = options.codec === 'prores';
    const isWebmAlpha = options.codec === 'vp8' || options.codec === 'vp9';
    const wantsAlpha = options.transparent === true && (isWebmAlpha || isProRes);
    const alphaPixelFormat = isProRes ? ('yuva444p10le' as const) : ('yuva420p' as const);

    console.log('[RemotionRenderer] Render config', { codec: options.codec, transparent: options.transparent, wantsAlpha, isProRes });

    // Capture the actual video encoder ffmpeg picks. Fires once — we latch
    // after the first reported encoder to avoid duplicate events across the
    // pre-stitcher/stitcher phases.
    let encoderReported = false;
    const ffmpegOverride = (info: { type: 'pre-stitcher' | 'stitcher'; args: string[] }): string[] => {
      const args = options.colorSpace === 'bt709' ? withBt709FilterTags(info.args) : info.args;
      if (!encoderReported) {
        const encoderName = extractVideoEncoder(info.args);
        if (encoderName) {
          encoderReported = true;
          onEncoderResolved?.({
            encoderName,
            hardwareAccelerated: isHardwareEncoder(encoderName),
          });
        }
      }
      return args;
    };

    // Remotion's stitchFramesToVideo rejects fractional output widths (e.g.
    // 1920 × 0.4444 = 853.33 for a 480p preset) and h264/h265 require even
    // dims for yuv420p chroma subsampling. Downscaling must stay on the
    // `scale` option (Chromium deviceScaleFactor — the page lays out at the
    // composition's real size, only the bitmap is resized): materializing
    // smaller composition dims at scale 1 re-lays-out the content, so
    // anything sized in absolute pixels renders oversized and cropped. So
    // snap the SCALE to the nearest value giving exact even-integer dims.
    // Only when no such scale exists near the request (near-coprime
    // composition dims) fall back to materializing dims — a distorted render
    // for pixel-sized content beats a crashed one. scale=1 stays untouched
    // so those renders are a perfect 1:1.
    const requestedScale = options.scale ?? 1;
    let renderWidth = width;
    let renderHeight = height;
    let effectiveScale = requestedScale;
    if (requestedScale !== 1) {
      const snapped = snapRenderScale(width, height, requestedScale);
      if (snapped) {
        effectiveScale = snapped.scale;
      } else {
        const roundEven = (n: number) => Math.max(2, Math.round(n / 2) * 2);
        renderWidth = roundEven(width * requestedScale);
        renderHeight = roundEven(height * requestedScale);
        effectiveScale = 1;
        console.warn(
          `[RemotionRenderer] No even-integer scale near ${requestedScale} for ${width}x${height} — ` +
          `rendering at materialized ${renderWidth}x${renderHeight}; pixel-sized content will not scale`
        );
      }
    }

    // Animated WebP has no Remotion codec — render a PNG sequence and
    // encode/mux it in the webp pipeline instead of calling renderMedia.
    if (options.codec === 'webp') {
      await renderAnimatedWebp(
        {
          bundleUrl: options.bundleUrl,
          compositionId: options.compositionId,
          outputPath: options.outputPath,
          width: renderWidth,
          height: renderHeight,
          fps,
          durationInFrames: totalFrames,
          scale: effectiveScale,
          everyNthFrame: options.everyNthFrame ?? 1,
          loopCount: options.numberOfGifLoops ?? 0,
          // For webp, `crf` carries the 1-100 quality (100 = lossless).
          quality: options.crf ?? 90,
          transparent: options.transparent === true,
          inputProps: options.inputProps ?? {},
          concurrency: options.cpuUsage ?? null,
          gpuBackend: options.gpuBackend,
          timeoutInMilliseconds: PER_FRAME_TIMEOUT_MS,
          cancelSignal,
        },
        ({ stage, framesDone, totalFrames: stageTotal }) => {
          // Frame rendering dominates wall-clock; encode+mux gets the tail.
          const percent =
            stage === 'render'
              ? Math.round((framesDone / stageTotal) * 80)
              : 80 + Math.round((framesDone / stageTotal) * 20);
          activeRender.progress = percent;
          onProgress({
            jobId,
            phase: 'rendering',
            percent,
            framesRendered: framesDone,
            totalFrames: stageTotal,
          });
        }
      );
      return;
    }

    await renderMedia({
      serveUrl: options.bundleUrl,
      composition: {
        id: options.compositionId,
        width: renderWidth,
        height: renderHeight,
        fps,
        durationInFrames: totalFrames,
        defaultProps: {},
        defaultCodec: null,
      },
      inputProps: options.inputProps ?? {},
      outputLocation: options.outputPath,
      codec: mapCodec(options.codec),
      // ProRes quality is set by the profile, not CRF — Remotion errors if both are passed.
      // Drop crf here so a stale queue entry or UI default can't break the render.
      crf: isProRes ? undefined : (options.crf ?? undefined),
      muted: options.muted ?? false,
      scale: effectiveScale,
      everyNthFrame: options.everyNthFrame ?? 1,
      numberOfGifLoops: options.numberOfGifLoops ?? null,
      ...(isProRes ? { proResProfile: '4444' as const } : {}),
      ...(wantsAlpha ? { pixelFormat: alphaPixelFormat, imageFormat: 'png' as const } : {}),
      ...(options.cpuUsage ? { concurrency: options.cpuUsage } : {}),
      chromiumOptions: {
        disableWebSecurity: true,
        // Only inject `gl` when the user picked a backend, so omitting it
        // preserves Remotion's default (swangle). selectComposition above
        // intentionally does NOT pass `gl` — it only extracts metadata, so
        // software is faster and avoids unnecessary GPU init.
        ...(options.gpuBackend ? { gl: options.gpuBackend } : {}),
      },
      hardwareAcceleration: options.hardwareAcceleration ?? 'disable',
      // Faster CPU encode preset than Remotion's default ('medium'): ~2× faster
      // at ~10–15% larger files for the same CRF. Remotion strict-validates this
      // option and rejects any codec other than h264, so spread it conditionally.
      ...(options.codec === 'h264' ? { x264Preset: 'veryfast' as const } : {}),
      ...(options.colorSpace ? { colorSpace: options.colorSpace } : {}),
      ...(options.audioCodec ? { audioCodec: options.audioCodec } : {}),
      ffmpegOverride,
      timeoutInMilliseconds: PER_FRAME_TIMEOUT_MS,
      cancelSignal,
      binariesDirectory: getRemotionBinariesDir() ?? undefined,
      onProgress: ({ progress, renderedFrames }) => {
        const percent = Math.round(progress * 100);
        activeRender.progress = percent;

        onProgress({
          jobId,
          phase: 'rendering',
          percent,
          framesRendered: renderedFrames,
          totalFrames,
        });
      },
    });
  };

  resolveAndRender()
    .then(async () => {
      activeRender.status = 'completed';

      // Get file size
      let fileSize = 0;
      try {
        const stats = await fs.stat(options.outputPath);
        fileSize = stats.size;
      } catch {
        // Ignore file size errors
      }

      onComplete({
        jobId,
        success: true,
        outputPath: options.outputPath,
        fileSize,
      });

      // Remove from active renders after a delay
      setTimeout(() => {
        activeRenders.delete(jobId);
      }, 5000);
    })
    .catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Unknown render error';
      const isCancelled = errorMessage.includes('cancel');

      activeRender.status = isCancelled ? 'cancelled' : 'failed';
      activeRender.error = errorMessage;

      onComplete({
        jobId,
        success: false,
        error: errorMessage,
      });

      // Remove from active renders after a delay
      setTimeout(() => {
        activeRenders.delete(jobId);
      }, 5000);
    });

  return jobId;
}

export function cancelRender(jobId: string): boolean {
  const render = activeRenders.get(jobId);
  if (!render) {
    return false;
  }

  render.cancel();
  render.status = 'cancelled';
  return true;
}

export function getActiveJobs(): RenderJob[] {
  return Array.from(activeRenders.values()).map((render) => ({
    jobId: render.jobId,
    compositionId: render.compositionId,
    outputPath: render.outputPath,
    status: render.status,
    progress: render.progress,
    error: render.error,
  }));
}
