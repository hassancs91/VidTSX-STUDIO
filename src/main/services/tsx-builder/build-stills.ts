// The builder's eyes (TSX_BUILDER_DESIGN.md T2 `render_stills`).
//
// Stills go through the Creator RENDER path — bundleComposition (the wrapper,
// the font-URL rewrite to the local proxy, webpack) then renderStill — so a
// still shows what an export would, not a preview approximation. Each image is
// downscaled to at most `maxSide` px and re-encoded as JPEG before it goes to
// the model (a 1080x1350 frame is ~1.4k image tokens at 1024 px), and the file
// on disk is overwritten with that copy: the saved stills are exactly what the
// builder saw, at a tenth of the full-size bytes.
//
// Each bundle is served under its own URL path (remotion-bundler.ts, P1 part
// 3), so two builds, or a build and a Refine, can render stills at once;
// `serveUrl` in the result says which bundle these stills came from.
//
// The look tools (builder-look-tools.ts) share the lower steps: one
// `prepareBuildRender` (bundle + selectComposition) per call, then
// `renderPreparedFrames` for the frames that call needs.
//
// Cancel: `signal` kills a webpack bundle in flight and cancels the
// renderStill in flight (Remotion's cancel signal); selectComposition has no
// cancel, so the signal is checked on each side of it.
//
// GL (P2 part 2): every builder render uses the backend probed once per app
// run (gl-backend-probe.ts): `angle` on a GPU, `swangle` where there is none.
// Before, stills passed no `gl` and WebGL drew on SwiftShader. The backend is
// fixed per prepared build, so the frames one look compares (loop_seam) come
// from one backend.

import fs from 'fs/promises';
import path from 'path';
import { nativeImage } from 'electron';
import { makeCancelSignal, renderStill, selectComposition } from '@remotion/renderer';
import type { VideoConfig } from 'remotion';
import { bundleComposition } from '../remotion-bundler';
import { getRemotionBinariesDir } from '../../utils/paths';
import { probeGlBackend, type ProbedGl } from '../gl-backend-probe';
import type { CompositionConfig } from '../composition-config-parser';
import type { Bitmap } from './loop-seam';

const STILL_TIMEOUT_MS = 120_000;

export interface BuildStill {
  frame: number;
  path: string;
  /** Base64 JPEG, downscaled for the model. */
  data: string;
  mimeType: 'image/jpeg';
}

export interface BuildStillsResult {
  stills: BuildStill[];
  ms: { bundle: number; render: number };
  bundleCached: boolean;
  serveUrl: string;
  gl: ProbedGl;
}

/** A bundled build with its composition selected: ready for renderStill. */
export interface PreparedBuild {
  serveUrl: string;
  composition: VideoConfig;
  /** The GL backend every frame of this build renders on. */
  gl: ProbedGl;
  bundleCached: boolean;
  ms: { bundle: number; select: number };
}

/** In range, integer, deduped, in order. */
export function clampFrames(frames: number[], durationInFrames: number): number[] {
  const last = Math.max(0, durationInFrames - 1);
  const clean = frames
    .filter((f) => Number.isFinite(f))
    .map((f) => Math.min(last, Math.max(0, Math.round(f))));
  return [...new Set(clean)].sort((a, b) => a - b);
}

/** The image as the model gets it: JPEG, no longer than `maxSide`, or exactly `width` wide. */
export function encodeForModel(file: string, fit: { maxSide: number } | { width: number }): Buffer {
  let image = nativeImage.createFromPath(file);
  const { width, height } = image.getSize();
  const scale = 'width' in fit ? fit.width / width : Math.min(1, fit.maxSide / Math.max(width, height));
  if (scale !== 1) {
    image = image.resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      quality: 'best',
    });
  }
  return image.toJPEG(85);
}

/** A rendered PNG as raw BGRA pixels. */
export function readBitmap(file: string): Bitmap {
  const image = nativeImage.createFromPath(file);
  const { width, height } = image.getSize();
  if (width === 0 || height === 0) throw new Error(`Could not read ${path.basename(file)}`);
  return { width, height, data: image.toBitmap() };
}

/**
 * Bundle the single-file artifact `code` and select its composition. The
 * entry (`<outDir>/<entryName>`) is stable per build and per kind of look, so
 * an unchanged artifact reuses its bundle. `gl` overrides the probed backend
 * (the spike's timing probe compares the two).
 */
export async function prepareBuildRender(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: { entryName?: string; signal?: AbortSignal; gl?: ProbedGl } = {},
): Promise<PreparedBuild> {
  const { signal } = options;
  signal?.throwIfAborted();
  const gl = options.gl ?? (await probeGlBackend()).gl;
  await fs.mkdir(outDir, { recursive: true });
  const entryPath = path.join(outDir, options.entryName ?? 'composition.tsx');
  await fs.writeFile(entryPath, code, 'utf-8');

  const bundleStart = Date.now();
  const bundle = await bundleComposition(entryPath, signal ? { signal } : undefined);
  const bundleMs = Date.now() - bundleStart;
  signal?.throwIfAborted();
  if (!bundle.success || !bundle.serveUrl) {
    throw new Error(`Bundling for stills failed: ${bundle.error ?? 'unknown error'}`);
  }

  const selectStart = Date.now();
  const composition = await selectComposition({
    serveUrl: bundle.serveUrl,
    id: config.id,
    inputProps: {},
    chromiumOptions: { disableWebSecurity: true, gl },
    timeoutInMilliseconds: STILL_TIMEOUT_MS,
    binariesDirectory: getRemotionBinariesDir() ?? undefined,
  });
  signal?.throwIfAborted();
  return {
    serveUrl: bundle.serveUrl,
    composition,
    gl,
    bundleCached: bundle.cached === true,
    ms: { bundle: bundleMs, select: Date.now() - selectStart },
  };
}

/** Render `frames` (clamped, in order) of a prepared build to `<outDir>/<label>-fNNN.<ext>`, full size. */
export async function renderPreparedFrames(
  prepared: PreparedBuild,
  outDir: string,
  frames: number[],
  options: { label: string; imageFormat?: 'jpeg' | 'png'; signal?: AbortSignal },
): Promise<Array<{ frame: number; path: string }>> {
  const { signal } = options;
  const imageFormat = options.imageFormat ?? 'jpeg';
  const binariesDirectory = getRemotionBinariesDir() ?? undefined;
  const { cancel, cancelSignal } = makeCancelSignal();
  signal?.addEventListener('abort', cancel, { once: true });
  const out: Array<{ frame: number; path: string }> = [];
  try {
    for (const frame of clampFrames(frames, prepared.composition.durationInFrames)) {
      signal?.throwIfAborted();
      const output = path.join(outDir, `${options.label}-f${String(frame).padStart(3, '0')}.${imageFormat === 'png' ? 'png' : 'jpg'}`);
      await renderStill({
        composition: prepared.composition,
        serveUrl: prepared.serveUrl,
        output,
        frame,
        imageFormat,
        ...(imageFormat === 'jpeg' ? { jpegQuality: 90 } : {}),
        inputProps: {},
        chromiumOptions: { disableWebSecurity: true, gl: prepared.gl },
        timeoutInMilliseconds: STILL_TIMEOUT_MS,
        binariesDirectory,
        cancelSignal,
      });
      out.push({ frame, path: output });
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  return out;
}

/**
 * Render `frames` of the single-file artifact `code` for the model. Each file
 * on disk is overwritten with the downscaled copy the model gets.
 */
export async function renderBuildStills(
  code: string,
  config: CompositionConfig,
  outDir: string,
  frames: number[],
  options: { maxSide?: number; label?: string; signal?: AbortSignal; gl?: ProbedGl } = {},
): Promise<BuildStillsResult> {
  const prepared = await prepareBuildRender(code, config, outDir, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.gl ? { gl: options.gl } : {}),
  });
  const renderStart = Date.now();
  const rendered = await renderPreparedFrames(prepared, outDir, frames, {
    label: options.label ?? 'still',
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const stills: BuildStill[] = [];
  for (const { frame, path: file } of rendered) {
    const seen = encodeForModel(file, { maxSide: options.maxSide ?? 1024 });
    await fs.writeFile(file, seen);
    stills.push({ frame, path: file, data: seen.toString('base64'), mimeType: 'image/jpeg' });
  }
  return {
    stills,
    ms: { bundle: prepared.ms.bundle, render: prepared.ms.select + Date.now() - renderStart },
    bundleCached: prepared.bundleCached,
    serveUrl: prepared.serveUrl,
    gl: prepared.gl,
  };
}
