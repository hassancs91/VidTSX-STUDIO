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
// `renderPreparedFrames` for the frames that call needs (each its own fresh
// page), or `renderPreparedInOrder` (one page, frames in order: purity_check).
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
//
// Assets (P2 part 4): a build whose staticFile() calls name files in its
// assets/ folder renders with `inputProps.assets` = each key's asset-root URL
// on the bundle server that serves this bundle (build-assets.ts), the same
// prop a saved version is played and exported with.
//
// Backdrop (P3 part 5): a transparent Studio shot's looks render a wrapper
// (look-backdrop.ts) that plays the footage under it; the footage file is
// served the same way and handed over as BACKDROP_PROP.

import fs from 'fs/promises';
import path from 'path';
import { nativeImage } from 'electron';
import { makeCancelSignal, renderFrames, renderStill, selectComposition } from '@remotion/renderer';
import type { VideoConfig } from 'remotion';
import { bundleComposition } from '../remotion-bundler';
import { getRemotionBinariesDir } from '../../utils/paths';
import { probeGlBackend, type ProbedGl } from '../gl-backend-probe';
import type { CompositionConfig } from '../composition-config-parser';
import type { Bitmap } from './loop-seam';
import { assetsProp, type AssetKeyMap } from './build-assets';
import { assetRootUrl } from '../asset-roots';
import { BACKDROP_PROP } from './look-backdrop';

/** A build's files: its assets folder and the lookup keys its code uses. */
export interface BuildAssetSource {
  dir: string;
  keys: AssetKeyMap;
}

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
  /** What every frame is rendered with: `{ assets }` when the build names files, plus any extra props; else `{}`. */
  inputProps: Record<string, unknown>;
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
 * (the spike's timing probe compares the two). `assets`: the build's files,
 * served from the bundle's own server.
 */
export async function prepareBuildRender(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: {
    entryName?: string;
    signal?: AbortSignal;
    gl?: ProbedGl;
    assets?: BuildAssetSource;
    /** More props for every frame (the 3D contact sheet's rendered tiles). */
    inputProps?: Record<string, unknown>;
    /** A video the look wrapper plays under a transparent shot (look-backdrop.ts). */
    backdropFile?: string;
  } = {},
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

  const keys = options.assets?.keys ?? {};
  const origin = new URL(bundle.serveUrl).origin;
  const inputProps: Record<string, unknown> = {
    ...options.inputProps,
    ...(options.assets && Object.keys(keys).length > 0 ? { assets: assetsProp(origin, options.assets.dir, keys) } : {}),
    ...(options.backdropFile
      ? { [BACKDROP_PROP]: assetRootUrl(origin, path.dirname(options.backdropFile), path.basename(options.backdropFile)) }
      : {}),
  };
  const selectStart = Date.now();
  const composition = await selectComposition({
    serveUrl: bundle.serveUrl,
    id: config.id,
    inputProps,
    chromiumOptions: { disableWebSecurity: true, gl },
    timeoutInMilliseconds: STILL_TIMEOUT_MS,
    binariesDirectory: getRemotionBinariesDir() ?? undefined,
  });
  signal?.throwIfAborted();
  return {
    serveUrl: bundle.serveUrl,
    composition,
    gl,
    inputProps,
    bundleCached: bundle.cached === true,
    ms: { bundle: bundleMs, select: Date.now() - selectStart },
  };
}

const framePath = (outDir: string, label: string, frame: number, ext: 'png' | 'jpg') =>
  path.join(outDir, `${label}-f${String(frame).padStart(3, '0')}.${ext}`);

/**
 * Render `frames` (clamped, in order) of a prepared build to `<outDir>/<label>-fNNN.<ext>`,
 * full size unless `scale`. Each frame is its own renderStill: a fresh page that renders only it.
 * `reverse` renders the last frame first (the purity check's "alone" pass).
 */
export async function renderPreparedFrames(
  prepared: PreparedBuild,
  outDir: string,
  frames: number[],
  options: { label: string; imageFormat?: 'jpeg' | 'png'; scale?: number; reverse?: boolean; signal?: AbortSignal },
): Promise<Array<{ frame: number; path: string }>> {
  const { signal } = options;
  const imageFormat = options.imageFormat ?? 'jpeg';
  const binariesDirectory = getRemotionBinariesDir() ?? undefined;
  const { cancel, cancelSignal } = makeCancelSignal();
  signal?.addEventListener('abort', cancel, { once: true });
  const out: Array<{ frame: number; path: string }> = [];
  const ordered = clampFrames(frames, prepared.composition.durationInFrames);
  if (options.reverse) ordered.reverse();
  try {
    for (const frame of ordered) {
      signal?.throwIfAborted();
      const output = framePath(outDir, options.label, frame, imageFormat === 'png' ? 'png' : 'jpg');
      await renderStill({
        composition: prepared.composition,
        serveUrl: prepared.serveUrl,
        output,
        frame,
        imageFormat,
        ...(imageFormat === 'jpeg' ? { jpegQuality: 90 } : {}),
        ...(options.scale ? { scale: options.scale } : {}),
        inputProps: prepared.inputProps,
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

/**
 * Render `frames` of the single-file artifact `code` for the model. Each file
 * on disk is overwritten with the downscaled copy the model gets.
 */
export async function renderBuildStills(
  code: string,
  config: CompositionConfig,
  outDir: string,
  frames: number[],
  options: {
    maxSide?: number;
    label?: string;
    signal?: AbortSignal;
    gl?: ProbedGl;
    assets?: BuildAssetSource;
    /** The look wrapper's own entry (look-backdrop.ts), and the footage under it. */
    entryName?: string;
    backdropFile?: string;
  } = {},
): Promise<BuildStillsResult> {
  const prepared = await prepareBuildRender(code, config, outDir, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.gl ? { gl: options.gl } : {}),
    ...(options.assets ? { assets: options.assets } : {}),
    ...(options.entryName ? { entryName: options.entryName } : {}),
    ...(options.backdropFile ? { backdropFile: options.backdropFile } : {}),
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
