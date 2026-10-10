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
// P0 note: bundleComposition serves ONE bundle at a time (the global
// currentBundlePath in remotion-bundler.ts). Fine for one build; P1 makes it
// per-build before two builds (or a build and a Refine) can run at once.

import fs from 'fs/promises';
import path from 'path';
import { nativeImage } from 'electron';
import { renderStill, selectComposition } from '@remotion/renderer';
import { bundleComposition } from '../remotion-bundler';
import { getRemotionBinariesDir } from '../../utils/paths';
import type { CompositionConfig } from '../composition-config-parser';

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
}

/** In range, integer, deduped, in order. */
export function clampFrames(frames: number[], durationInFrames: number): number[] {
  const last = Math.max(0, durationInFrames - 1);
  const clean = frames
    .filter((f) => Number.isFinite(f))
    .map((f) => Math.min(last, Math.max(0, Math.round(f))));
  return [...new Set(clean)].sort((a, b) => a - b);
}

function downscaleJpeg(file: string, maxSide: number): Buffer {
  let image = nativeImage.createFromPath(file);
  const { width, height } = image.getSize();
  const longest = Math.max(width, height);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    image = image.resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      quality: 'best',
    });
  }
  return image.toJPEG(85);
}

/**
 * Render `frames` of the single-file artifact `code`. `outDir` holds the entry
 * copy and the JPEGs; the entry path is stable per build so an unchanged
 * artifact reuses its bundle.
 */
export async function renderBuildStills(
  code: string,
  config: CompositionConfig,
  outDir: string,
  frames: number[],
  options: { maxSide?: number; label?: string } = {},
): Promise<BuildStillsResult> {
  await fs.mkdir(outDir, { recursive: true });
  const entryPath = path.join(outDir, 'composition.tsx');
  await fs.writeFile(entryPath, code, 'utf-8');

  const bundleStart = Date.now();
  const bundle = await bundleComposition(entryPath);
  const bundleMs = Date.now() - bundleStart;
  if (!bundle.success || !bundle.serveUrl) {
    throw new Error(`Bundling for stills failed: ${bundle.error ?? 'unknown error'}`);
  }

  const binariesDirectory = getRemotionBinariesDir() ?? undefined;
  const renderStart = Date.now();
  const composition = await selectComposition({
    serveUrl: bundle.serveUrl,
    id: config.id,
    inputProps: {},
    chromiumOptions: { disableWebSecurity: true },
    timeoutInMilliseconds: STILL_TIMEOUT_MS,
    binariesDirectory,
  });

  const stills: BuildStill[] = [];
  const label = options.label ?? 'still';
  for (const frame of clampFrames(frames, composition.durationInFrames)) {
    const output = path.join(outDir, `${label}-f${String(frame).padStart(3, '0')}.jpg`);
    await renderStill({
      composition,
      serveUrl: bundle.serveUrl,
      output,
      frame,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      inputProps: {},
      chromiumOptions: { disableWebSecurity: true },
      timeoutInMilliseconds: STILL_TIMEOUT_MS,
      binariesDirectory,
    });
    const seen = downscaleJpeg(output, options.maxSide ?? 1024);
    await fs.writeFile(output, seen);
    stills.push({ frame, path: output, data: seen.toString('base64'), mimeType: 'image/jpeg' });
  }

  return {
    stills,
    ms: { bundle: bundleMs, render: Date.now() - renderStart },
    bundleCached: bundle.cached === true,
  };
}
