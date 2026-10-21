// The number sweep (P4-12): the visible text of (nearly) every frame, for
// number_check (number-check.ts). A look reads the text of the frames the
// builder picks; a step label beside an interpolated total disagrees on 3 of
// every 4 frames, so the check needs them all.
//
// A 2D piece is mounted SWEEP_PAGE_TILES times per page, each tile frozen at
// its own frame and tagged with FRAME_TEXT_ATTR, the way the contact sheet
// mounts it (contact-sheet.ts `mountablePiece`); page k of the sweep
// composition holds frames k*N .. k*N+N-1, so one bundle serves every page and
// each page is one renderStill whose frame-text probe reports a group per
// tile. A WebGL piece renders frame by frame instead (a page of canvases drops
// a context, P2 problem 1), on fewer frames. Nothing is shown to the model;
// the small screenshots are deleted. The probe also lists drawn shapes (P5-4),
// so one sweep serves number_check and text_overlaps (text-overlaps.ts).

import fs from 'fs/promises';
import { prepareBuildRender, renderPreparedFrames, type BuildAssetSource } from './build-stills';
import { mountablePiece } from './contact-sheet';
import { FRAME_TEXT_ATTR, type FrameTextGroup } from './frame-text';
import type { SweepFrame } from './number-check';
import type { CompositionConfig } from '../composition-config-parser';

/** Tiles mounted per sweep page. */
export const SWEEP_PAGE_TILES = 24;
/** Frames a 2D sweep reads at most; a longer piece is read every Nth frame. */
export const SWEEP_MAX_FRAMES = 300;
/** Frames a WebGL sweep reads at most (one page each). */
export const SWEEP_MAX_FRAMES_GL = 60;
/** A tile's size against the piece: small, since only the text boxes are read. */
const TILE_SCALE = 0.25;

/** Every `step`-th frame from 0, and the last, so the sweep covers the whole piece. */
export function sweepFrames(durationInFrames: number, maxFrames: number): { frames: number[]; step: number } {
  const step = Math.max(1, Math.ceil(durationInFrames / maxFrames));
  const frames: number[] = [];
  for (let f = 0; f < durationInFrames; f += step) frames.push(f);
  if (frames[frames.length - 1] !== durationInFrames - 1) frames.push(durationInFrames - 1);
  return { frames, step };
}

/** The sweep composition: page k (its frame k) mounts `pages[k]`, each tile tagged with its frame. */
export function sweepSource(code: string, config: CompositionConfig, frames: number[]): { code: string; config: CompositionConfig; pages: number } {
  const { piece, pieceRef } = mountablePiece(code);
  const pages: number[][] = [];
  for (let i = 0; i < frames.length; i += SWEEP_PAGE_TILES) pages.push(frames.slice(i, i + SWEEP_PAGE_TILES));
  const cols = Math.ceil(Math.sqrt(SWEEP_PAGE_TILES));
  const rows = Math.ceil(SWEEP_PAGE_TILES / cols);
  const tw = Math.ceil(config.width * TILE_SCALE);
  const th = Math.ceil(config.height * TILE_SCALE);
  const even = (v: number) => v + (v % 2);
  const sweepConfig: CompositionConfig = {
    id: 'VidtsxNumberSweep',
    width: even(cols * tw),
    height: even(rows * th),
    fps: config.fps,
    // The tiles' Sequences carry the build's length, so the page index stays under it.
    durationInFrames: Math.max(config.durationInFrames, pages.length),
  };
  const S = { w: config.width, h: config.height, d: config.durationInFrames, s: TILE_SCALE, tw, th, cols, pages };
  const c = sweepConfig;
  const source = `export const compositionConfig = { id: '${c.id}', durationInFrames: ${c.durationInFrames}, fps: ${c.fps}, width: ${c.width}, height: ${c.height} };
import __VidtsxReact from 'react';
import { Freeze as __VidtsxFreeze, Sequence as __VidtsxSequence, useCurrentFrame as __vidtsxUseCurrentFrame } from 'remotion';
${piece}

const __vidtsxSweep = ${JSON.stringify(S)};

export default function VidtsxNumberSweep(props) {
  const h = __VidtsxReact.createElement;
  const S = __vidtsxSweep;
  const page = S.pages[__vidtsxUseCurrentFrame()] || [];
  return h('div', { style: { position: 'absolute', inset: 0, background: '#000' } },
    page.map((frame, i) => h('div', { key: frame, '${FRAME_TEXT_ATTR}': frame, style: { position: 'absolute', left: (i % S.cols) * S.tw, top: Math.floor(i / S.cols) * S.th, width: S.tw, height: S.th, overflow: 'hidden' } },
      h('div', { style: { position: 'absolute', left: 0, top: 0, width: S.w, height: S.h, transform: 'scale(' + S.s + ')', transformOrigin: '0 0' } },
        h(__VidtsxSequence, { from: 0, durationInFrames: S.d, width: S.w, height: S.h, name: 'frame ' + frame },
          h(__VidtsxFreeze, { frame }, h(${pieceRef}, props)))))));
}
`;
  return { code: source, config: sweepConfig, pages: pages.length };
}

const unscale = <T extends { x: number; y: number; w: number; h: number }>(b: T, scale: number): T => ({
  ...b,
  x: b.x / scale,
  y: b.y / scale,
  w: b.w / scale,
  h: b.h / scale,
});

/** Text and shape boxes from tile pixels back to the piece's own. */
export function toPiece(groups: FrameTextGroup[], scale: number): SweepFrame[] {
  return groups
    .filter((g) => g.frame !== null)
    .map((g) => ({
      frame: g.frame!,
      items: g.items.map((i) => unscale(i, scale)),
      shapes: (g.shapes ?? []).map((s) => unscale(s, scale)),
      moreShapes: g.moreShapes ?? 0,
    }));
}

export interface NumberSweep {
  frames: SweepFrame[];
  /** Frames swept over between two read frames (1 = every frame). */
  step: number;
  tiles: 'mounted' | 'separate';
  /** Swept frames whose page reported no text at all (a probe that did not run). */
  unread: number;
  ms: number;
}

export async function sweepFrameText(
  code: string,
  config: CompositionConfig,
  outDir: string,
  options: { label: string; webgl?: boolean; signal?: AbortSignal; assets?: BuildAssetSource },
): Promise<NumberSweep> {
  const started = Date.now();
  const signal = options.signal ? { signal: options.signal } : {};
  const prepareExtra = { ...signal, ...(options.assets ? { assets: options.assets } : {}) };
  if (options.webgl) {
    const { frames, step } = sweepFrames(config.durationInFrames, SWEEP_MAX_FRAMES_GL);
    const piece = await prepareBuildRender(code, config, outDir, { ...prepareExtra, frameText: 'shapes' });
    const rendered = await renderPreparedFrames(piece, outDir, frames, { label: options.label, scale: TILE_SCALE, frameText: true, ...signal });
    await Promise.all(rendered.map((r) => fs.rm(r.path, { force: true })));
    // A still's page is the piece at its own size (the scale only shrinks the screenshot).
    const read = rendered.map((r) => {
      const groups = (r.text ?? []).filter((g) => g.frame === null);
      return {
        frame: r.frame,
        items: groups.flatMap((g) => g.items),
        shapes: groups.flatMap((g) => g.shapes ?? []),
        moreShapes: groups.reduce((sum, g) => sum + (g.moreShapes ?? 0), 0),
      };
    });
    return { frames: read, step, tiles: 'separate', unread: rendered.filter((r) => !r.text).length, ms: Date.now() - started };
  }
  const { frames, step } = sweepFrames(config.durationInFrames, SWEEP_MAX_FRAMES);
  const sweep = sweepSource(code, config, frames);
  const prepared = await prepareBuildRender(sweep.code, sweep.config, outDir, { entryName: 'number-sweep.tsx', frameText: 'shapes', ...prepareExtra });
  const pageFrames = Array.from({ length: sweep.pages }, (_, k) => k);
  const rendered = await renderPreparedFrames(prepared, outDir, pageFrames, { label: options.label, frameText: true, ...signal });
  await Promise.all(rendered.map((r) => fs.rm(r.path, { force: true })));
  const read = toPiece(rendered.flatMap((r) => r.text ?? []), TILE_SCALE);
  const seen = new Set(read.map((r) => r.frame));
  // A tile with no visible text still reports its (empty) group; a page that never reported loses its tiles.
  const all = frames.map((frame) => read.find((r) => r.frame === frame) ?? { frame, items: [], shapes: [], moreShapes: 0 });
  return { frames: all, step, tiles: 'mounted', unread: frames.filter((f) => !seen.has(f)).length, ms: Date.now() - started };
}
