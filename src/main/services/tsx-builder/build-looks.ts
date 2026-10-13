// The three looks besides plain stills (TSX_BUILDER_DESIGN.md T2), as render
// services: builder-look-tools.ts wraps them as tools, the spike probes call
// them directly. Each is one bundle + one selectComposition, then its frames.
//
// - contact sheet: N frames as tiles in one ≤1024 px image (contact-sheet.ts).
// - phone view: one frame at the width a phone feed shows the piece.
// - loop seam: frames last-1, last, 0 and 1 as PNGs, measured (loop-seam.ts).
// - frame purity: sample frames in order in one page and alone in fresh pages,
//   compared (frame-purity.ts).

import fs from 'fs/promises';
import path from 'path';
import {
  clampFrames,
  encodeForModel,
  prepareBuildRender,
  readBitmap,
  renderPreparedFrames,
  renderPreparedInOrder,
  type BuildAssetSource,
} from './build-stills';
import { CONTACT_SHEET_MAX_FRAMES, CONTACT_SHEET_MAX_SIDE, contactSheetSource, type SheetLayout } from './contact-sheet';
import { measureSeam, type SeamMeasure } from './loop-seam';
import { measurePurity, PURITY_MAX_FRAMES, PURITY_MAX_SIDE, purityFrames, type PurityMeasure } from './frame-purity';
import type { CompositionConfig } from '../composition-config-parser';
import type { ProbedGl } from '../gl-backend-probe';

/**
 * A phone feed shows a post at the screen's width, whatever its format: about
 * 390 pt (an iPhone 15). A 1080-wide piece is shown at 36%, so 30 px text
 * reads as ~11 pt, about the smallest a viewer reads without effort.
 */
export const PHONE_FEED_WIDTH = 390;

export interface LookOptions {
  label: string;
  signal?: AbortSignal;
  /** The build's files (assets/), when its code names any. */
  assets?: BuildAssetSource;
}

/** What prepareBuildRender takes from a look's options. */
const prepareOptions = (options: LookOptions) => ({
  ...(options.signal ? { signal: options.signal } : {}),
  ...(options.assets ? { assets: options.assets } : {}),
});

export interface LookImage {
  path: string;
  /** Base64 JPEG, what the model gets. */
  data: string;
  mimeType: 'image/jpeg';
  ms: { bundle: number; render: number };
  bundleCached: boolean;
  gl: ProbedGl;
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
  const prepared = await prepareBuildRender(sheet.code, sheet.config, outDir, { entryName: 'contact-sheet.tsx', ...prepareOptions(options) });
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
    gl: prepared.gl,
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
  const prepared = await prepareBuildRender(code, config, outDir, prepareOptions(options));
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
    gl: prepared.gl,
  };
}

/** The wrap last → 0 against its neighbours, measured on full-size PNGs. */
export async function measureLoopSeam(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: LookOptions,
): Promise<SeamMeasure & { last: number; ms: { bundle: number; render: number }; bundleCached: boolean; gl: ProbedGl }> {
  const last = config.durationInFrames - 1;
  if (last < 3) throw new Error('A loop needs at least 4 frames to measure its seam.');
  const started = Date.now();
  const signal = options.signal ? { signal: options.signal } : {};
  const prepared = await prepareBuildRender(code, config, outDir, prepareOptions(options));
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
  return { ...measure, last, ms: elapsedSince(started, prepared.ms.bundle), bundleCached: prepared.bundleCached, gl: prepared.gl };
}

/**
 * Is every frame a function of its frame number? `frames` (default: a third,
 * two thirds, the last) rendered IN ORDER in one page and ALONE in fresh pages
 * (last first), at PURITY_MAX_SIDE, compared pixel for pixel.
 */
export async function measureFramePurity(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: LookOptions & { frames?: number[] },
): Promise<
  PurityMeasure & {
    scale: number;
    /** Frames the in-order pass rendered (0..last sample). */
    inOrderFrames: number;
    paths: Array<{ frame: number; inOrder: string; alone: string }>;
    ms: { bundle: number; inOrder: number; alone: number };
    bundleCached: boolean;
    gl: ProbedGl;
  }
> {
  const picked = clampFrames(options.frames?.length ? options.frames : purityFrames(config.durationInFrames), config.durationInFrames).slice(
    0,
    PURITY_MAX_FRAMES,
  );
  const scale = Math.min(1, PURITY_MAX_SIDE / Math.max(config.width, config.height));
  const signal = options.signal ? { signal: options.signal } : {};
  const prepared = await prepareBuildRender(code, config, outDir, prepareOptions(options));
  const orderStart = Date.now();
  const inOrder = await renderPreparedInOrder(prepared, outDir, picked, { label: `${options.label}-order`, scale, ...signal });
  const aloneStart = Date.now();
  const alone = await renderPreparedFrames(prepared, outDir, picked, {
    label: `${options.label}-alone`,
    imageFormat: 'png',
    scale,
    reverse: true,
    ...signal,
  });
  const done = Date.now();
  const aloneAt = new Map(alone.map((a) => [a.frame, a.path]));
  const pairs = inOrder.frames.map((o) => ({ frame: o.frame, inOrder: o.path, alone: aloneAt.get(o.frame)! }));
  const measure = measurePurity(
    pairs.map((p) => ({ frame: p.frame, inOrder: readBitmap(p.inOrder), alone: readBitmap(p.alone) })),
  );
  return {
    ...measure,
    scale,
    inOrderFrames: inOrder.rendered,
    paths: pairs,
    ms: { bundle: prepared.ms.bundle, inOrder: aloneStart - orderStart, alone: done - aloneStart },
    bundleCached: prepared.bundleCached,
    gl: prepared.gl,
  };
}
