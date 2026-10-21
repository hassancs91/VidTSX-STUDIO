// The numbers check (P4-12): the one-clock rule as a measure, not a prompt
// line. P4's exit kept the rule in METHOD and the builder still finished E3
// with YEAR = floor(t) beside totals drawn from the continuous t (f130 "YEAR 7"
// beside year 7.5's money), with that exact text in its own look.
//
// Input: the visible text nodes of (nearly) every frame, from the number sweep
// (number-sweep.ts). A number on screen is followed from frame to frame as a
// TRACK: a text node with a digit, matched to the nearest node of the same
// shape ("+$# this year", "#") on the frame before, so a label that rides on a
// growing pile stays one track. Then:
// - a STEP LABEL is a track of plain whole numbers (no $, %, ×, decimals or
//   thousands commas) that changes at least MIN_STEP_CHANGES times: "YEAR 7",
//   "STEP 12", the "7" of a split "YEAR " + "7";
// - SPLIT: another number that moves over the label's span (it starts and
//   stops moving with the label) and changes between two of the label's
//   changes, while the label holds. One clock means every number beside a
//   step label comes from that integer step, so it changes on the label's
//   frames only. This is what blocks `finish`.
// - FIXED: a number shown unchanged on nearly every frame while others move.
//   A unit or a given ("1 coin = $200", "$10,000 at 8%") is fine; a result
//   typed in at its final value is not. Listed, never blocking: the text
//   cannot tell them apart, the builder can.
// Pure, so it is tested on text alone (number-check.test.ts).

import type { FrameText, FrameTextItem } from './frame-text';

/** One frame of the sweep: its visible text nodes, boxes in the piece's own pixels. */
export interface SweepFrame {
  frame: number;
  items: FrameTextItem[];
}

/** A step label must change this often to count as one (a two-value toggle is not a counter). */
export const MIN_STEP_CHANGES = 3;
/** Changes of the other number while the label holds, across the run, before it is a split. */
export const MIN_SPLIT_FRAMES = 3;
/** ...spread over at least this many of the label's steps (one stray frame at one step is not a clock). */
const MIN_SPLIT_STEPS = 2;
/**
 * A number is paired with a step label only when it starts and stops moving
 * within this many frames, or this share of the label's span, of the label.
 * E2's tree STEPS stop at f60 while the scan's ROWS READ run to f150: the two
 * sides of a race, not a label and its values.
 */
const SAME_SPAN_FRAMES = 4;
const SAME_SPAN_SHARE = 0.15;
/** A fixed number is on screen on at least this share of the swept frames. */
const FIXED_SHARE = 0.9;
/** Splits and fixed numbers reported; the rest are counted. */
const MAX_REPORTED = 6;
/** How far a node may move between two swept frames and stay the same track, as a share of the piece's longer side per frame swept over. */
const MATCH_SHARE = 0.06;

const HAS_DIGIT = /\d/;
/** A plain whole number: the step-label shape. */
const PLAIN_WHOLE = /^[^\d$€£¥%×.,]*\d{1,4}[^\d$€£¥%×.,]*$/;

/** The node's shape with its numbers taken out: what stays the same while the value changes. */
export function numberShape(text: string): string {
  return text
    .replace(/\d[\d,.]*/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Point {
  frame: number;
  value: string;
  x: number;
  y: number;
  /** The nearest text without a digit on that frame ("YEAR" beside a "7"), for the report. */
  context: string;
}

interface Track {
  id: number;
  shape: string;
  points: Point[];
}

const centre = (i: FrameTextItem) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 });

/** How much of the smaller box the two share. */
function overlap(a: FrameTextItem, b: FrameTextItem): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

function nearestWord(item: FrameTextItem, words: FrameTextItem[]): string {
  const c = centre(item);
  let best: { d: number; t: string } | null = null;
  for (const w of words) {
    const wc = centre(w);
    const d = Math.hypot(wc.x - c.x, wc.y - c.y);
    if (d <= Math.max(item.h, w.h) * 4 && (!best || d < best.d)) best = { d, t: w.t.trim() };
  }
  return best?.t ?? '';
}

/** Numbers on screen, frame by frame, joined into tracks. */
export function numberTracks(frames: SweepFrame[], piece: { width: number; height: number }): Track[] {
  const tracks: Track[] = [];
  let open: Array<{ track: Track; x: number; y: number }> = [];
  let prevFrame: number | null = null;
  for (const { frame, items } of [...frames].sort((a, b) => a.frame - b.frame)) {
    const words = items.filter((i) => !HAS_DIGIT.test(i.t) && i.t.trim());
    const numbers = items
      .filter((i) => HAS_DIGIT.test(i.t))
      // The same text drawn twice on one spot (a shadow, an outline, a glow) is one number.
      .filter((i, n, all) => all.findIndex((j) => j.t.trim() === i.t.trim() && overlap(i, j) > 0.5) === n);
    const gap = prevFrame === null ? 1 : Math.max(1, frame - prevFrame);
    const reach = Math.max(piece.width, piece.height) * MATCH_SHARE * gap;
    // Closest pairs first, so two labels of one shape side by side keep their own tracks.
    const pairs: Array<{ n: number; o: number; d: number }> = [];
    numbers.forEach((item, n) => {
      const c = centre(item);
      const shape = numberShape(item.t);
      open.forEach((o, oi) => {
        if (o.track.shape !== shape) return;
        const d = Math.hypot(o.x - c.x, o.y - c.y);
        if (d <= reach) pairs.push({ n, o: oi, d });
      });
    });
    pairs.sort((a, b) => a.d - b.d);
    const takenN = new Set<number>();
    const takenO = new Set<number>();
    const next: typeof open = [];
    const place = (n: number, track: Track) => {
      const item = numbers[n];
      const c = centre(item);
      track.points.push({ frame, value: item.t.trim(), x: c.x, y: c.y, context: nearestWord(item, words) });
      next.push({ track, x: c.x, y: c.y });
    };
    for (const p of pairs) {
      if (takenN.has(p.n) || takenO.has(p.o)) continue;
      takenN.add(p.n);
      takenO.add(p.o);
      place(p.n, open[p.o].track);
    }
    numbers.forEach((item, n) => {
      if (takenN.has(n)) return;
      const track: Track = { id: tracks.length, shape: numberShape(item.t), points: [] };
      tracks.push(track);
      place(n, track);
    });
    open = next;
    prevFrame = frame;
  }
  return tracks;
}

/** Frames where the track shows a value different from its previous swept frame (both on screen, consecutive in the sweep). */
function changeFrames(track: Track, order: Map<number, number>): number[] {
  const out: number[] = [];
  for (let i = 1; i < track.points.length; i++) {
    const a = track.points[i - 1];
    const b = track.points[i];
    if (order.get(b.frame)! - order.get(a.frame)! === 1 && a.value !== b.value) out.push(b.frame);
  }
  return out;
}

const isStepLabel = (track: Track) => track.points.every((p) => PLAIN_WHOLE.test(p.value));

const label = (p: Point) => (p.context ? `${p.context} ${p.value}` : p.value);

export interface NumberSplit {
  /** The step label: its text where it first holds while the other moves, and how often it changes. */
  step: string;
  stepChanges: number;
  /** The other number, as first seen moving under the held label. */
  other: string;
  /** Frames where it changed while the label held. */
  frames: number[];
  /** One held stretch as read: `f129: YEAR 7 · $17,138` … */
  example: string[];
}

export interface NumberCheck {
  ok: boolean;
  /** Swept frames, and the first and last. */
  swept: number;
  span: [number, number];
  tracks: number;
  stepLabels: number;
  splits: NumberSplit[];
  /** Numbers on (nearly) every frame, never changing, while others move. */
  fixed: string[];
  /** True when any number on screen changes at all (a piece without moving numbers has nothing to split). */
  moving: boolean;
}

export function checkNumbers(frames: SweepFrame[], piece: { width: number; height: number }): NumberCheck {
  const sorted = [...frames].sort((a, b) => a.frame - b.frame);
  const order = new Map(sorted.map((f, i) => [f.frame, i]));
  const tracks = numberTracks(sorted, piece);
  const changes = new Map(tracks.map((t) => [t.id, changeFrames(t, order)]));
  const moving = tracks.some((t) => changes.get(t.id)!.length > 0);
  const steps = tracks.filter((t) => isStepLabel(t) && changes.get(t.id)!.length >= MIN_STEP_CHANGES);

  const splits: NumberSplit[] = [];
  for (const step of steps) {
    const stepChanges = changes.get(step.id)!;
    const at = new Map(step.points.map((p) => [p.frame, p]));
    const stepSpan = stepChanges[stepChanges.length - 1] - stepChanges[0];
    for (const other of tracks) {
      if (other.id === step.id) continue;
      // Only a number that moves over the label's span: the label's own values. Two sides of
      // a race on one shared time stop at different frames, and their counters may tick apart.
      const otherChanges = changes.get(other.id)!;
      if (otherChanges.length === 0) continue;
      const tol = Math.max(SAME_SPAN_FRAMES, stepSpan * SAME_SPAN_SHARE);
      if (Math.abs(otherChanges[0] - stepChanges[0]) > tol || Math.abs(otherChanges[otherChanges.length - 1] - stepChanges[stepChanges.length - 1]) > tol) continue;
      const hits: number[] = [];
      const heldIn = new Set<number>();
      for (const f of changes.get(other.id)!) {
        // Held: the label is on screen on this frame and the one before, unchanged.
        const i = order.get(f)!;
        if (i === 0) continue;
        const before = at.get(sorted[i - 1].frame);
        const now = at.get(f);
        if (!before || !now || before.value !== now.value) continue;
        // Inside the label's stepping (between its first and last change), not a hold before or after it.
        if (f <= stepChanges[0] || f >= stepChanges[stepChanges.length - 1]) continue;
        hits.push(f);
        heldIn.add(stepChanges.findIndex((c) => c > f));
      }
      if (hits.length < MIN_SPLIT_FRAMES || heldIn.size < MIN_SPLIT_STEPS) continue;
      const first = hits[0];
      const i = order.get(first)!;
      const window = sorted.slice(Math.max(0, i - 1), Math.min(sorted.length, i + 2)).map((f) => f.frame);
      const otherAt = new Map(other.points.map((p) => [p.frame, p]));
      const example = window
        .filter((f) => at.has(f) && otherAt.has(f))
        .map((f) => `f${f}: ${label(at.get(f)!)} · ${label(otherAt.get(f)!)}`);
      splits.push({ step: label(at.get(first)!), stepChanges: stepChanges.length, other: label(otherAt.get(first)!), frames: hits, example });
    }
  }
  splits.sort((a, b) => b.frames.length - a.frames.length);

  const fixed = moving
    ? tracks
        .filter((t) => changes.get(t.id)!.length === 0 && t.points.length >= sorted.length * FIXED_SHARE)
        .map((t) => label(t.points[0]))
    : [];

  return {
    ok: splits.length === 0,
    swept: sorted.length,
    span: [sorted[0]?.frame ?? 0, sorted[sorted.length - 1]?.frame ?? 0],
    tracks: tracks.length,
    stepLabels: steps.length,
    splits,
    fixed: [...new Set(fixed)],
    moving,
  };
}

/**
 * True when a look's frames show different numbers: the piece has numbers that
 * move, so `finish` holds it to number_check. A title card, a 3D turntable or
 * a piece whose numbers never change does not pay for a sweep.
 */
export function numbersDiffer(texts: Array<FrameText | null | undefined>): boolean {
  const seen = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    seen.add(
      t.lines
        .flatMap((l) => l.text.match(/\d[\d,.]*/g) ?? [])
        .sort()
        .join(' '),
    );
  }
  return seen.size > 1;
}

/** The verdict for the model. */
export function describeNumberCheck(check: NumberCheck, note = ''): string {
  const head = `Numbers check: ${check.swept} frames swept (${check.span[0]}-${check.span[1]}${note}), ${check.tracks} numbers followed, ${check.stepLabels} step label${check.stepLabels === 1 ? '' : 's'}.`;
  const lines = [head];
  if (!check.moving) {
    lines.push('No number on screen changes: nothing to compare. Verdict: OK.');
    return lines.join('\n');
  }
  if (check.splits.length === 0) {
    lines.push('Every number changes only on its step label\'s frames. Verdict: OK.');
  } else {
    lines.push(`Verdict: SPLIT. ${check.splits.length} number${check.splits.length === 1 ? '' : 's'} change${check.splits.length === 1 ? 's' : ''} while a step label holds, so the label and the number run on two clocks:`);
    // Two numbers that read the same (both jars at $10,200 in year 1) are one line.
    const merged = new Map<string, { split: NumberSplit; count: number }>();
    for (const s of check.splits) {
      const key = `${s.other}|${s.step}|${s.frames.join(',')}`;
      const hit = merged.get(key);
      if (hit) hit.count += 1;
      else merged.set(key, { split: s, count: 1 });
    }
    for (const { split: s, count } of [...merged.values()].slice(0, MAX_REPORTED)) {
      const many = count > 1 ? ` (${count} numbers)` : '';
      lines.push(`- "${s.other}"${many} changed on ${s.frames.length} frames while "${s.step}" held (frames ${s.frames.slice(0, 8).join(', ')}${s.frames.length > 8 ? ', …' : ''}). Read: ${s.example.join(' → ')}`);
    }
    if (merged.size > MAX_REPORTED) lines.push(`- + ${merged.size - MAX_REPORTED} more`);
    lines.push('Fix: compute the step as ONE integer per frame and draw every number beside it from that step (or animate the label with the values). Then run number_check again.');
  }
  if (check.fixed.length > 0) {
    const shown = check.fixed.slice(0, MAX_REPORTED).map((f) => `"${f}"`).join(', ');
    const more = check.fixed.length > MAX_REPORTED ? ` + ${check.fixed.length - MAX_REPORTED} more` : '';
    lines.push(`Fixed on every frame while other numbers move (not blocking): ${shown}${more}. A unit or a given is fine; a result, total or badge shown before the marks and counters reach it is not.`);
  }
  return lines.join('\n');
}
