// The three looks besides plain stills (TSX_BUILDER_DESIGN.md T2), as render
// services: builder-look-tools.ts wraps them as tools, the spike probes call
// them directly. Each is one bundle + one selectComposition, then its frames.
//
// - contact sheet: N frames as tiles in one ≤1024 px image (contact-sheet.ts).
// - phone view: one frame at the width a phone feed shows the piece.
// - loop seam: frames last-1, last, 0 and 1 as PNGs, measured (loop-seam.ts).

import fs from 'fs/promises';
import path from 'path';
import {
  clampFrames,
  encodeForModel,
  prepareBuildRender,
  readBitmap,
  renderPreparedFrames,
} from './build-stills';
import { CONTACT_SHEET_MAX_FRAMES, CONTACT_SHEET_MAX_SIDE, contactSheetSource, type SheetLayout } from './contact-sheet';
import { measureSeam, type SeamMeasure } from './loop-seam';
import type { CompositionConfig } from '../composition-config-parser';

/**
 * A phone feed shows a post at the screen's width, whatever its format: about
 * 390 pt (an iPhone 15). A 1080-wide piece is shown at 36%, so 30 px text
 * reads as ~11 pt, about the smallest a viewer reads without effort.
 */
export const PHONE_FEED_WIDTH = 390;

export interface LookOptions {
  label: string;
  signal?: AbortSignal;
}

export interface LookImage {
  path: string;
  /** Base64 JPEG, what the model gets. */
  data: string;
  mimeType: 'image/jpeg';
  ms: { bundle: number; render: number };
  bundleCached: boolean;
}

const elapsedSince = (started: number, bundleMs: number) => ({ bundle: bundleMs, render: Date.now() - started - bundleMs });

/** `frames` (clamped, deduped, in order, at most 12) as one labelled grid. */
export async function renderContactSheet(
  code: string,
  config: CompositionConfig,
  outDir: string,
  frames: number[],
  options: LookOptions,
): Promise<LookImage & { frames: number[]; layout: SheetLayout }> {
  const started = Date.now();
  const picked = clampFrames(frames, config.durationInFrames).slice(0, CONTACT_SHEET_MAX_FRAMES);
  const sheet = contactSheetSource(code, config, picked);
  const signal = options.signal ? { signal: options.signal } : {};
  const prepared = await prepareBuildRender(sheet.code, sheet.config, outDir, { entryName: 'contact-sheet.tsx', ...signal });
  const [image] = await renderPreparedFrames(prepared, outDir, [0], { label: options.label, ...signal });
  const seen = encodeForModel(image.path, { maxSide: CONTACT_SHEET_MAX_SIDE });
  const file = path.join(outDir, `${options.label}.jpg`);
  await fs.writeFile(file, seen);
  await fs.rm(image.path, { force: true });
  return {
    path: file,
    data: seen.toString('base64'),
    mimeType: 'image/jpeg',
    frames: picked,
    layout: sheet.layout,
    ms: elapsedSince(started, prepared.ms.bundle),
    bundleCached: prepared.bundleCached,
  };
}

/** One frame, `PHONE_FEED_WIDTH` px wide. */
export async function renderPhoneView(
  code: string,
  config: CompositionConfig,
  outDir: string,
  frame: number,
  options: LookOptions,
): Promise<LookImage & { frame: number; width: number; height: number }> {
  const started = Date.now();
  const signal = options.signal ? { signal: options.signal } : {};
  const prepared = await prepareBuildRender(code, config, outDir, signal);
  const [image] = await renderPreparedFrames(prepared, outDir, [frame], { label: options.label, ...signal });
  const seen = encodeForModel(image.path, { width: PHONE_FEED_WIDTH });
  await fs.writeFile(image.path, seen);
  return {
    path: image.path,
    data: seen.toString('base64'),
    mimeType: 'image/jpeg',
    frame: image.frame,
    width: PHONE_FEED_WIDTH,
    height: Math.round((config.height * PHONE_FEED_WIDTH) / config.width),
    ms: elapsedSince(started, prepared.ms.bundle),
    bundleCached: prepared.bundleCached,
  };
}

/** The wrap last → 0 against its neighbours, measured on full-size PNGs. */
export async function measureLoopSeam(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: LookOptions,
): Promise<SeamMeasure & { last: number; ms: { bundle: number; render: number }; bundleCached: boolean }> {
  const last = config.durationInFrames - 1;
  if (last < 3) throw new Error('A loop needs at least 4 frames to measure its seam.');
  const started = Date.now();
  const signal = options.signal ? { signal: options.signal } : {};
  const prepared = await prepareBuildRender(code, config, outDir, signal);
  const rendered = await renderPreparedFrames(prepared, outDir, [0, 1, last - 1, last], {
    label: options.label,
    imageFormat: 'png',
    ...signal,
  });
  const at = new Map(rendered.map((r) => [r.frame, r.path]));
  const measure = measureSeam({
    beforeLast: readBitmap(at.get(last - 1)!),
    last: readBitmap(at.get(last)!),
    first: readBitmap(at.get(0)!),
    afterFirst: readBitmap(at.get(1)!),
  });
  return { ...measure, last, ms: elapsedSince(started, prepared.ms.bundle), bundleCached: prepared.bundleCached };
}
