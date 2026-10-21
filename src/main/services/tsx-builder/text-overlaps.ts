// Text overlaps (P5-4): text on text and text crossing a drawn shape, on every
// swept frame. A look shows a few frames; a label that slides under a bar for
// half a second, or two counters that meet mid-race, sit between them.
//
// Input: the number sweep's frames (number-sweep.ts), text boxes plus the
// drawn shapes the probe lists (frame-text.ts, `shapes`). Then:
// - TEXT ON TEXT: two shown text nodes whose INK BANDS (the box less its
//   top and bottom fifth) share more than TEXT_ON_TEXT_SHARE of the smaller
//   band. The same text drawn again on the
//   same spot (a shadow, an outline, a glow) is one text; a pair where either
//   side is faint, or whose opacities add up to under CROSSFADE_SUM, is a
//   crossfade, not a collision.
// - TEXT ON A SHAPE: a shape PAINTED OVER the text (after it in document
//   order; z-index is not read) whose box enters the text's CORE (its box
//   less TEXT_CORE_INSET on each side) while the text is not (nearly) inside
//   the shape. A line through a word, a bar sliding over a label, a marker on
//   it count; a label on its own pill, a caption on a card, a word on a
//   backdrop grid or disc drawn under it do not (legibility there is
//   phone_view's job). Only shapes whose box is their ink are read: rect, circle,
//   ellipse, an HTML box, and a line or path at most THIN_SHAPE_PX thick (an
//   axis, a rule). A curve's or a diagonal's box says nothing of where its ink
//   is, so they are skipped, like text on a canvas, in 3D or in an image.
// Hits on consecutive swept frames join into one RUN per pair (digits masked,
// so a counting "$16,240" stays one text). Listed for the builder, never a
// finish gate. Pure, so it is tested on boxes alone (text-overlaps.test.ts).

import { FAINT_BELOW, type FrameShape, type FrameTextItem } from './frame-text';
import type { SweepFrame } from './number-check';

/** Text on text: the share of the smaller ink band two texts must share. */
export const TEXT_ON_TEXT_SHARE = 0.2;
/**
 * Text on text compares ink bands: each box less this share of its height at the top and the bottom. A text
 * node's box is the font's content area (~1.15-1.4 em) while capitals and digits sit in its middle ~0.7 em, so
 * lines stacked at lineHeight 1 overlap by box and not by ink (P5 part 2 bench: r1's total, E2 / R2's timers).
 */
export const TEXT_INK_INSET = 0.2;
/** A text's core: its box less this share of its width / height on each side. */
export const TEXT_CORE_INSET = 0.2;
/** A text this much inside a shape sits on it (a label on its pill): not a hit. */
export const TEXT_INSIDE_SHAPE = 0.9;
/** A line, polyline, polygon or path counts only when its box is this thin (piece px): an axis or a rule. */
export const THIN_SHAPE_PX = 6;
/** Runs listed for the model; the rest are counted. */
export const MAX_LISTED_OVERLAPS = 12;
/** Two texts whose opacities add up to less than this are a crossfade (its sides add up to about one), not a collision. */
export const CROSSFADE_SUM = 1.5;
/** The same text this much over itself is a shadow / outline: one text. */
const SAME_SPOT = 0.5;
const BOX_KINDS = new Set(['rect', 'circle', 'ellipse', 'box']);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OverlapRun {
  kind: 'text' | 'shape';
  /** The texts as first seen: two for text on text, one for text on a shape. */
  texts: string[];
  /** Text on a shape: the shape's kind (an SVG tag, or "box"). */
  shape?: string;
  /** First and last swept frame of the run, and how many swept frames it spans. */
  from: number;
  to: number;
  frames: number;
  /** Text on text: the largest share of the smaller box; on a shape: the largest share of the text's core covered. */
  share: number;
  /** Where, on the run's first frame (the text's box). */
  at: Box;
}

export interface OverlapCheck {
  clear: boolean;
  swept: number;
  runs: OverlapRun[];
  /** Shapes read across the sweep, and those past the probe's cap. */
  shapesRead: number;
  moreShapes: number;
  /** Swept frames with shapes listed at all (0 = the probe did not list shapes). */
  framesWithShapes: number;
}

function cut(a: Box, b: Box): { w: number; h: number } {
  return {
    w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y),
  };
}

/** Shared area over the smaller box (0 when apart). */
function shareOfSmaller(a: Box, b: Box): number {
  const { w, h } = cut(a, b);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/** The text's box less TEXT_CORE_INSET on each side. */
function core(t: Box): Box {
  return { x: t.x + t.w * TEXT_CORE_INSET, y: t.y + t.h * TEXT_CORE_INSET, w: t.w * (1 - 2 * TEXT_CORE_INSET), h: t.h * (1 - 2 * TEXT_CORE_INSET) };
}

/** Does `s` reach into `c`? A zero-thick box (a hairline's: SVG boxes leave the stroke out) counts as a sliver. */
function enters(s: Box, c: Box): boolean {
  const w = Math.max(s.w, 0.01);
  const h = Math.max(s.h, 0.01);
  return s.x < c.x + c.w && c.x < s.x + w && s.y < c.y + c.h && c.y < s.y + h;
}

/** A text's ink band: its box less TEXT_INK_INSET at the top and the bottom (the font's ascent and descent room). */
function ink(t: Box): Box {
  return { x: t.x, y: t.y + t.h * TEXT_INK_INSET, w: t.w, h: t.h * (1 - 2 * TEXT_INK_INSET) };
}

const known = (i: number | undefined): i is number => typeof i === 'number' && i >= 0;

/** Is the shape painted over the text? Document order stands for paint order; without it, assume so. */
function paintedOver(s: FrameShape, t: FrameTextItem): boolean {
  return !known(s.i) || !known(t.i) || s.i > t.i;
}

/** A shape whose box is its ink. */
export function readableShape(s: FrameShape): boolean {
  return BOX_KINDS.has(s.k) || Math.min(s.w, s.h) <= THIN_SHAPE_PX;
}

const mask = (t: string) => t.trim().replace(/\d+(?:[.,]\d+)*/g, '#');
const shown = (t: FrameTextItem) => t.o >= FAINT_BELOW && t.t.trim() !== '';
const box = (b: Box): Box => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });

interface Hit {
  key: string;
  kind: 'text' | 'shape';
  texts: string[];
  shape?: string;
  share: number;
  at: Box;
}

/** The hits on one frame. */
export function frameOverlaps(items: FrameTextItem[], shapes: FrameShape[]): Hit[] {
  const texts = items.filter(shown);
  const hits: Hit[] = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (a.t.trim() === b.t.trim() && shareOfSmaller(a, b) > SAME_SPOT) continue; // a shadow, an outline, a glow
      const share = shareOfSmaller(ink(a), ink(b));
      if (share <= TEXT_ON_TEXT_SHARE) continue;
      if (a.o + b.o < CROSSFADE_SUM) continue; // mid-crossfade: one fades out as the other fades in
      const [first, second] = [a, b].sort((p, q) => (mask(p.t) < mask(q.t) ? -1 : mask(p.t) > mask(q.t) ? 1 : 0));
      hits.push({ key: `T|${mask(first.t)}|${mask(second.t)}`, kind: 'text', texts: [first.t.trim(), second.t.trim()], share, at: box(a) });
    }
  }
  const drawn = shapes.filter((s) => s.o >= FAINT_BELOW && readableShape(s));
  for (const t of texts) {
    const c = core(t);
    for (const s of drawn) {
      if (!paintedOver(s, t) || !enters(s, c)) continue;
      const inside = cut(t, s);
      if (inside.w > 0 && inside.h > 0 && (inside.w * inside.h) / (t.w * t.h) >= TEXT_INSIDE_SHAPE) continue; // a label on its shape
      const onCore = cut(c, s);
      const share = c.w * c.h > 0 ? (Math.max(0, onCore.w) * Math.max(0, onCore.h)) / (c.w * c.h) : 0;
      hits.push({ key: `S|${mask(t.t)}|${s.k}`, kind: 'shape', texts: [t.t.trim()], shape: s.k, share, at: box(t) });
    }
  }
  return hits;
}

export function checkOverlaps(frames: SweepFrame[]): OverlapCheck {
  const sorted = [...frames].sort((a, b) => a.frame - b.frame);
  const runs: OverlapRun[] = [];
  /** The open run per pair, and the swept index it was last seen on. */
  const open = new Map<string, { run: OverlapRun; last: number }>();
  let shapesRead = 0;
  let moreShapes = 0;
  let framesWithShapes = 0;
  sorted.forEach(({ frame, items, shapes, moreShapes: more }, index) => {
    if (shapes) {
      shapesRead += shapes.length;
      if (shapes.length) framesWithShapes += 1;
    }
    moreShapes += more ?? 0;
    const seen = new Set<string>();
    for (const hit of frameOverlaps(items, shapes ?? [])) {
      if (seen.has(hit.key)) {
        const now = open.get(hit.key)!.run;
        now.share = Math.max(now.share, hit.share);
        continue;
      }
      seen.add(hit.key);
      const prev = open.get(hit.key);
      if (prev && prev.last === index - 1) {
        prev.run.to = frame;
        prev.run.frames += 1;
        prev.run.share = Math.max(prev.run.share, hit.share);
        prev.last = index;
        continue;
      }
      const run: OverlapRun = {
        kind: hit.kind,
        texts: hit.texts,
        ...(hit.shape ? { shape: hit.shape } : {}),
        from: frame,
        to: frame,
        frames: 1,
        share: hit.share,
        at: hit.at,
      };
      runs.push(run);
      open.set(hit.key, { run, last: index });
    }
  });
  runs.sort((a, b) => b.frames - a.frames || a.from - b.from);
  return { clear: runs.length === 0, swept: sorted.length, runs, shapesRead, moreShapes, framesWithShapes };
}

const quote = (t: string) => `"${t.length > 60 ? `${t.slice(0, 59)}…` : t}"`;
const span = (r: OverlapRun) => (r.from === r.to ? `f${r.from}` : `f${r.from}-${r.to}`);
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** What the builder reads. `note`: how the frames were swept (", every 2th frame"). */
export function describeOverlaps(result: OverlapCheck, note = ''): string {
  const read =
    'Read: HTML and SVG text against each other (the ink, not the line box) and against rects, circles, ellipses, HTML boxes (a background or a border) and thin lines drawn AFTER the text (on top of it, by document order; z-index is not read); shapes under the text, curves, diagonal lines, and anything on a canvas, in 3D or in an image are not read.';
  const head = `text_overlaps on ${result.swept} frames${note}`;
  const capped = result.moreShapes > 0 ? ` (${result.moreShapes} shapes past the cap not read)` : '';
  if (result.clear) return `${head}: CLEAR, no text on text and no text crossing a drawn shape${capped}.\n${read}`;
  const lines = result.runs.slice(0, MAX_LISTED_OVERLAPS).map((r) => {
    const where = `at x ${r.at.x}, y ${r.at.y}`;
    const length = `${span(r)} (${r.frames} swept frame${r.frames === 1 ? '' : 's'})`;
    return r.kind === 'text'
      ? `- ${quote(r.texts[0])} on ${quote(r.texts[1])}: ${length}, up to ${pct(r.share)} of the smaller text, ${where}`
      : `- ${quote(r.texts[0])} crossed by a ${r.shape}: ${length}${r.share >= 0.01 ? `, up to ${pct(r.share)} of the text's middle covered` : ''}, ${where}`;
  });
  const rest = result.runs.length - MAX_LISTED_OVERLAPS;
  if (rest > 0) lines.push(`+ ${rest} more not listed`);
  return [
    `${head}: OVERLAPS, ${result.runs.length} (longest first)${capped}. Not enforced: fix each that is a collision (text hidden, crossed or hard to read); keep what is meant (a marker on purpose, a label riding its bar).`,
    ...lines,
    read,
  ].join('\n');
}
