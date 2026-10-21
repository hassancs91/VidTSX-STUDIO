// The contact sheet (TSX_BUILDER_DESIGN.md T2 `contact_sheet`): N frames of a
// build as tiles in ONE image, so the builder can run the random-frame test
// for the price of one still.
//
// The sheet is its own single-file composition: the build's code with its
// exports renamed, plus a grid that mounts the build once per tile inside a
// `<Sequence width height durationInFrames>` (so useVideoConfig() inside still
// reports the build's own size and length) and a `<Freeze frame>`, scaled down
// with a CSS transform. The whole file is the bundle entry, so the font-URL
// rewrite and the bundle cache key cover the build's code too. A WebGL piece
// is the exception (`tileSheetSource`): its frames are rendered one per page
// first, and the sheet only lays those images out.

import type { CompositionConfig } from '../composition-config-parser';
import { FRAME_TEXT_ATTR } from './frame-text';

export const CONTACT_SHEET_MAX_FRAMES = 12;
/** Longest side of the sheet, rendered at this size (no downscale after). */
export const CONTACT_SHEET_MAX_SIDE = 1024;
const GAP = 8;
const LABEL_H = 22;

export interface SheetLayout {
  cols: number;
  rows: number;
  /** Build px → sheet px. */
  scale: number;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  /** Tile order: left to right, top to bottom. `y` is the label's top; the tile sits under it. */
  cells: Array<{ frame: number; x: number; y: number }>;
}

/** The grid that gives the biggest tiles inside a `maxSide` square. */
export function contactSheetLayout(
  piece: { width: number; height: number },
  frames: number[],
  maxSide = CONTACT_SHEET_MAX_SIDE,
): SheetLayout {
  const n = Math.max(1, frames.length);
  let best = { cols: 1, rows: n, scale: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const scale = Math.min(
      (maxSide - (cols + 1) * GAP) / (cols * piece.width),
      (maxSide - (rows + 1) * GAP - rows * LABEL_H) / (rows * piece.height),
    );
    if (scale > best.scale) best = { cols, rows, scale };
  }
  const { cols, rows } = best;
  const tileWidth = Math.floor(piece.width * best.scale);
  const tileHeight = Math.floor(piece.height * best.scale);
  const scale = Math.min(tileWidth / piece.width, tileHeight / piece.height);
  const cells = frames.map((frame, i) => ({
    frame,
    x: GAP + (i % cols) * (tileWidth + GAP),
    y: GAP + Math.floor(i / cols) * (LABEL_H + tileHeight + GAP),
  }));
  const even = (v: number) => v + (v % 2);
  return {
    cols,
    rows,
    scale,
    tileWidth,
    tileHeight,
    width: even(cols * tileWidth + (cols + 1) * GAP),
    height: even(rows * (LABEL_H + tileHeight) + (rows + 1) * GAP),
    cells,
  };
}

/** Where cell `i`'s picture sits in the sheet: under its label, at tile size. */
export function sheetTileRect(layout: SheetLayout, i: number): { x: number; y: number; width: number; height: number } {
  const cell = layout.cells[i];
  return { x: cell.x, y: cell.y + LABEL_H, width: layout.tileWidth, height: layout.tileHeight };
}

const CONFIG_EXPORT = /export\s+const\s+compositionConfig\s*=/;
const DEFAULT_FUNCTION = /export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/;
const DEFAULT_EXPORT = /export\s+default\s+/;

/**
 * The sheet's source, from a build's single-file artifact (what `check`
 * returns). Throws when the artifact lacks the exports every gate requires.
 */
export function contactSheetSource(
  code: string,
  config: CompositionConfig,
  frames: number[],
): { code: string; config: CompositionConfig; layout: SheetLayout } {
  const { piece, pieceRef } = mountablePiece(code);
  const layout = contactSheetLayout(config, frames);
  // Each tile mounts the build, scaled down; props (the build's `assets`) go to every tile.
  const tile = `h('div', { style: { position: 'absolute', left: 0, top: 0, width: S.w, height: S.h, transform: 'scale(' + S.s + ')', transformOrigin: '0 0' } },
          h(__VidtsxSequence, { from: 0, durationInFrames: S.d, width: S.w, height: S.h, name: 'frame ' + c.frame },
            h(__VidtsxFreeze, { frame: c.frame }, h(${pieceRef}, props))))`;
  return sheetSource(config, layout, `import { Freeze as __VidtsxFreeze, Sequence as __VidtsxSequence } from 'remotion';\n${piece}`, tile);
}

/**
 * The build as a component another composition can mount: its config renamed
 * and its default export a plain declaration named `pieceRef`. Shared by the
 * contact sheet and the number sweep (number-sweep.ts). Throws when the
 * artifact lacks the exports every gate requires.
 */
export function mountablePiece(code: string): { piece: string; pieceRef: string } {
  if (!CONFIG_EXPORT.test(code)) throw new Error('The build has no `export const compositionConfig`.');
  // Every `compositionConfig` in the build is renamed, references included:
  // the sheet's own config takes the exported name the wrapper reads.
  let piece = code.replace(/\bcompositionConfig\b/g, '__vidtsxPieceConfig');
  piece = piece.replace(/export\s+const\s+__vidtsxPieceConfig\s*=/, 'const __vidtsxPieceConfig =');
  let pieceRef = '__vidtsxPiece';
  const fn = DEFAULT_FUNCTION.exec(piece);
  if (fn) {
    pieceRef = fn[1];
    piece = piece.replace(DEFAULT_FUNCTION, `function ${fn[1]}(`);
  } else if (DEFAULT_EXPORT.test(piece)) {
    piece = piece.replace(DEFAULT_EXPORT, 'const __vidtsxPiece = ');
  } else {
    throw new Error('The build has no default export.');
  }
  return { piece, pieceRef };
}

/**
 * The sheet for a WebGL piece (P2 problem 1): its tiles are frames already
 * rendered one per page, passed in as `props.tiles` (data URLs, in cell
 * order). Mounting a 3D piece once per tile puts a dozen WebGL canvases with
 * their post-processing buffers in one page, and Chrome drops a context.
 */
export function tileSheetSource(config: CompositionConfig, frames: number[]): { code: string; config: CompositionConfig; layout: SheetLayout } {
  const layout = contactSheetLayout(config, frames);
  const tile = `h(__VidtsxImg, { src: props.tiles[i], style: { position: 'absolute', left: 0, top: 0, width: S.tw, height: S.th } })`;
  return sheetSource(config, layout, `import { Img as __VidtsxImg } from 'remotion';`, tile);
}

/** One sheet composition: the grid, each cell's label above its tile; `tile` is the expression for cell `c` (index `i`). */
function sheetSource(
  config: CompositionConfig,
  layout: SheetLayout,
  imports: string,
  tile: string,
): { code: string; config: CompositionConfig; layout: SheetLayout } {
  const sheetConfig: CompositionConfig = {
    id: 'VidtsxContactSheet',
    width: layout.width,
    height: layout.height,
    fps: config.fps,
    // The tiles' Sequences carry the build's length; the sheet renders frame 0.
    durationInFrames: config.durationInFrames,
  };
  const sheet = {
    w: config.width,
    h: config.height,
    d: config.durationInFrames,
    fps: config.fps,
    s: layout.scale,
    tw: layout.tileWidth,
    th: layout.tileHeight,
    lh: LABEL_H,
    cells: layout.cells,
  };

  const c = sheetConfig;
  const source = `export const compositionConfig = { id: '${c.id}', durationInFrames: ${c.durationInFrames}, fps: ${c.fps}, width: ${c.width}, height: ${c.height} };
import __VidtsxReact from 'react';
${imports}

const __vidtsxSheet = ${JSON.stringify(sheet)};

export default function VidtsxContactSheet(props) {
  const h = __VidtsxReact.createElement;
  const S = __vidtsxSheet;
  return h('div', { style: { position: 'absolute', inset: 0, background: '#1f2023' } },
    S.cells.map((c, i) => h('div', { key: c.frame, style: { position: 'absolute', left: c.x, top: c.y, width: S.tw, height: S.lh + S.th } },
      h('div', { style: { height: S.lh, lineHeight: S.lh + 'px', color: '#e8eaed', fontSize: 14, fontFamily: 'Arial, sans-serif' } },
        'frame ' + c.frame + '  ·  ' + (c.frame / S.fps).toFixed(1) + ' s'),
      h('div', { '${FRAME_TEXT_ATTR}': c.frame, style: { position: 'absolute', left: 0, top: S.lh, width: S.tw, height: S.th, overflow: 'hidden' } },
        ${tile}))));
}
`;
  return { code: source, config: sheetConfig, layout };
}
