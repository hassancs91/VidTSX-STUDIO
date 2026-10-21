// The race check (P5-1): both sides of a race on one time scale. P4-12's
// SPLIT pairs a number with a step label only over the label's own span, so
// the two sides of a race, which stop at different frames, are never paired.
// E2 and its re-run R2 drew the scan's clock and the index's clock at
// different rates: "0.25 s" beside "1.0 ms" at f45, 0.0167 against 0.000067
// shown seconds per frame. The motion said ~4×, the counters 1,000×.
//
// A TIME COUNTER is a track whose values carry a time unit, in the node
// ("2.0 ms") or as the word right beside it ("2.00" + "s"). Its RUN is the
// longest stretch of changes in one direction (a reset to 0 before the count
// is its own, shorter stretch). Two counters whose runs start together are a
// race, and one time scale means they show the same time per frame. A side
// that ends within FAST_FRAMES frames is consistent when the other side's
// rate would have finished it that fast: that is what a right 1000× race
// looks like (the index done on its first frame). Unlike units (ROWS READ vs
// STEPS) are not compared: the text cannot say what one frame of each is.
// Pure, so it is tested on text alone (number-race.test.ts).

import type { FrameTextItem } from './frame-text';
import type { Point, SweepFrame, Track } from './number-check';

/** Shown seconds per frame may differ by this factor and still be one time scale. */
export const RACE_RATE_TOLERANCE = 1.5;
/** A side that runs this few frames is consistent when the other side's rate gets it there as fast. */
const FAST_FRAMES = 2;
/** The two runs start within this many frames, or this share of the longer run, of each other. */
const START_FRAMES = 4;
const START_SHARE = 0.15;
/** The slower side must be a real counter: at least this many changes in its run. */
const MIN_RUN_CHANGES = 3;
/** A track counts as a time counter when this share of its points carry the same unit. */
const UNIT_SHARE = 0.8;

const UNIT_SECONDS: Array<[RegExp, number]> = [
  [/^(ns|nanoseconds?)$/i, 1e-9],
  [/^(µs|μs|us|microseconds?)$/i, 1e-6],
  [/^(ms|msec|milliseconds?)$/i, 1e-3],
  [/^(s|sec|secs|seconds?)$/i, 1],
  [/^(min|mins|minutes?)$/i, 60],
  [/^(h|hr|hrs|hours?)$/i, 3600],
];

function unitSeconds(word: string): number | null {
  const w = word.trim();
  for (const [re, s] of UNIT_SECONDS) if (re.test(w)) return s;
  return null;
}

/** "2.00 s" → 2.00 and "s"; "2.00" → 2.00 and ''. */
function splitValue(text: string): { value: number; rest: string } | null {
  const m = text.trim().match(/^[^\d-]*?(-?\d[\d,]*(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(value) ? { value, rest: m[2] } : null;
}

/** The word right of the box on the same line: a unit set as its own node. */
function wordBeside(box: Point['box'], words: FrameTextItem[]): string | null {
  const cy = box.y + box.h / 2;
  const right = box.x + box.w;
  let best: { d: number; t: string } | null = null;
  for (const w of words) {
    if (Math.abs(w.y + w.h / 2 - cy) > Math.max(box.h, w.h) / 2) continue;
    const d = w.x - right;
    if (d < -box.h * 0.3 || d > box.h) continue;
    if (!best || d < best.d) best = { d, t: w.t };
  }
  return best?.t ?? null;
}

/** Seconds shown on each point, or null when the track is not a time counter. */
function secondsOf(track: Track, wordsAt: Map<number, FrameTextItem[]>): Map<number, number> | null {
  const units = new Map<number, number>();
  const out = new Map<number, number>();
  for (const p of track.points) {
    const v = splitValue(p.value);
    if (!v) continue;
    const own = v.rest ? unitSeconds(v.rest.split(/\s+/)[0]) : null;
    const unit = own ?? (v.rest ? null : unitSeconds(wordBeside(p.box, wordsAt.get(p.frame) ?? []) ?? ''));
    if (unit === null) continue;
    units.set(unit, (units.get(unit) ?? 0) + 1);
    out.set(p.frame, v.value * unit);
  }
  const top = [...units.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < track.points.length * UNIT_SHARE) return null;
  return out;
}

interface Run {
  track: Track;
  /** The frame the count starts from (the swept frame before its first change) and its last change. */
  from: number;
  to: number;
  changes: number;
  /** Shown seconds covered by the run, and per frame. */
  seconds: number;
  rate: number;
  /** The text at the run's end, for the report. */
  end: string;
}

/** The longest stretch of changes in one direction. */
function runOf(track: Track, seconds: Map<number, number>, order: Map<number, number>): Run | null {
  const pts = track.points.filter((p) => seconds.has(p.frame));
  let best: Run | null = null;
  let start = -1;
  let dir = 0;
  let count = 0;
  const close = (endIdx: number) => {
    if (start < 0 || count === 0) return;
    const a = pts[start];
    const b = pts[endIdx];
    const covered = Math.abs(seconds.get(b.frame)! - seconds.get(a.frame)!);
    const frames = Math.max(1, b.frame - a.frame);
    const run: Run = { track, from: a.frame, to: b.frame, changes: count, seconds: covered, rate: covered / frames, end: b.value };
    if (!best || run.changes > best.changes) best = run;
  };
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const step = seconds.get(cur.frame)! - seconds.get(prev.frame)!;
    const consecutive = order.get(cur.frame)! - order.get(prev.frame)! === 1;
    if (!consecutive) {
      close(i - 1);
      start = -1;
      dir = 0;
      count = 0;
      continue;
    }
    if (step === 0) continue;
    const s = Math.sign(step);
    if (start < 0 || s !== dir) {
      close(i - 1);
      start = i - 1;
      dir = s;
      count = 0;
    }
    count += 1;
    // A run's end is its last change; holds after it are not part of it.
    close(i);
  }
  return best;
}

export interface NumberRace {
  /** The two counters as they read at the end of their runs, slower side first. */
  slow: string;
  fast: string;
  slowFrames: [number, number];
  fastFrames: [number, number];
  /** How much longer the slow side runs on screen, and how much more time its counter shows. */
  motionRatio: number;
  counterRatio: number;
}

const fmtRatio = (r: number) => (r >= 100 ? Math.round(r).toLocaleString('en-US') : r >= 10 ? r.toFixed(0) : r.toFixed(1));

export function findRaces(tracks: Track[], frames: SweepFrame[], order: Map<number, number>): NumberRace[] {
  const wordsAt = new Map(frames.map((f) => [f.frame, f.items.filter((i) => !/\d/.test(i.t) && i.t.trim())]));
  const runs: Run[] = [];
  for (const t of tracks) {
    const seconds = secondsOf(t, wordsAt);
    if (!seconds) continue;
    const run = runOf(t, seconds, order);
    if (run && run.seconds > 0) runs.push(run);
  }
  const races: NumberRace[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const [slow, fast] = runs[i].to - runs[i].from >= runs[j].to - runs[j].from ? [runs[i], runs[j]] : [runs[j], runs[i]];
      if (slow.changes < MIN_RUN_CHANGES) continue;
      const tol = Math.max(START_FRAMES, (slow.to - slow.from) * START_SHARE);
      if (Math.abs(slow.from - fast.from) > tol) continue;
      const ratio = Math.max(slow.rate, fast.rate) / Math.min(slow.rate, fast.rate);
      if (ratio <= RACE_RATE_TOLERANCE) continue;
      // The fast side done at once, as the slow side's rate would have it: a right race.
      if (fast.to - fast.from <= FAST_FRAMES && fast.seconds <= slow.rate * FAST_FRAMES) continue;
      races.push({
        slow: slow.end,
        fast: fast.end,
        slowFrames: [slow.from, slow.to],
        fastFrames: [fast.from, fast.to],
        motionRatio: Math.max(1, slow.to - slow.from) / Math.max(1, fast.to - fast.from),
        counterRatio: slow.seconds / fast.seconds,
      });
    }
  }
  return races;
}

/** The verdict lines for the model; `badges` = fixed numbers that state a ratio, quoted against the motion (P5-2). */
export function describeRaces(races: NumberRace[], badges: string[]): string[] {
  if (races.length === 0) return [];
  const lines = [`Verdict: RACE. ${races.length === 1 ? 'Two clocks race' : `${races.length} pairs of clocks race`} on different time scales:`];
  for (const r of races.slice(0, 4)) {
    lines.push(
      `- "${r.slow}" runs f${r.slowFrames[0]}-${r.slowFrames[1]} and "${r.fast}" f${r.fastFrames[0]}-${r.fastFrames[1]}: the motion says ~${fmtRatio(r.motionRatio)}×, the counters ${fmtRatio(r.counterRatio)}×.`,
    );
  }
  if (badges.length > 0) {
    lines.push(`The fixed ${badges.map((b) => `"${b}"`).join(', ')} states the counters' ratio; the motion shows ~${fmtRatio(races[0].motionRatio)}×.`);
  }
  lines.push(
    'Fix: run both sides on ONE clock (shown time = t × the same rate for both). The slower side\'s length sets the run; a side that is 1,000× faster finishes on its first frame. Then run number_check again.',
  );
  return lines;
}
