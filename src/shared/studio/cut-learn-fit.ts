// Learn the cut knobs, step 2 (B4): the knob values whose snapped edges sit
// closest to the user's own edges — the sweep the clean-cut skill fits a
// style with, run on the joins the user touched. Pure.
//
// Why a fit and not the raw medians: the snapper's tail is not a knob value.
// With Hasan's fitted tight (minTail 0.08, margin 12) the tails it keeps run
// ~0.14 s and land a few dB UNDER floor + 12 (the 20 ms walk stops at the
// first window at or below the margin), so the median tail and median landing
// level cannot be read back as minTail and margin. The L1 fit can: it reduces
// to the median where the rule is a constant (a lead-in without `maxHead`).
//
// Errors are whole milliseconds, so ties are exact. Ties: the current value
// wins when it is among the best (the user's edges already fit the style);
// otherwise the largest minTail, the middle of the margin / head plateau, the
// maxTail nearest the current one (a cap the edges never reach is unknown).

import type { CutPlanStyle } from '../types/studio-cut-plan';
import type { CutLearnHeadSample, CutLearnTailSample } from './cut-learn-measure';

const HEAD_GRID = grid(0, 0.4, 0.01);
const MIN_TAIL_GRID = grid(0, 0.4, 0.01);
const MAX_TAIL_GRID = grid(0.1, 1.5, 0.05);
const MARGIN_GRID = grid(0, 30, 0.5);
/** How far past a word the tail walk is read (the longest maxTail candidate). */
const WALK_LIMIT = 1.5;

export interface FittedTails {
  minTail: number;
  maxTail: number;
  margin: number;
}

/** The `head` whose planner lead-ins sit closest to the user's (L1, ms). */
export function fitHead(samples: CutLearnHeadSample[], style: CutPlanStyle, margin: number): number {
  // snapHead with head 0 = how far the onset reaches back (+30 ms, ≤ maxHead);
  // the planner keeps max(head, that). Without maxHead the lead-in is `head`.
  const reach = samples.map((s) =>
    style.maxHead
      ? s.envelope.snapHead(s.wordStart, 0, style.maxHead, margin, style.fricZcr, style.fricMargin ?? 5.0)
      : 0,
  );
  const candidates = withCurrent(HEAD_GRID, style.head);
  const scored = candidates.map((h) => ({
    h,
    err: samples.reduce((sum, s, i) => sum + Math.abs(ms(Math.max(h, reach[i])) - ms(s.user)), 0),
  }));
  const best = Math.min(...scored.map((c) => c.err));
  const tied = scored.filter((c) => c.err === best).map((c) => c.h);
  if (tied.includes(style.head)) return style.head;
  return nearest(tied, (Math.min(...tied) + Math.max(...tied)) / 2);
}

/**
 * The punchy-landing knobs (`minTail`, `maxTail`, `margin`) whose tails sit
 * closest to the user's (L1, ms), every join modelled as a punchy landing —
 * the knobs learn-from-video proposes. The planner's gap clamp uses `head`.
 */
export function fitTails(samples: CutLearnTailSample[], style: CutPlanStyle, head: number): FittedTails {
  const fricMargin = style.fricMargin ?? 5.0;
  const mins = withCurrent(MIN_TAIL_GRID, style.minTail);
  const maxes = withCurrent(MAX_TAIL_GRID, style.maxTail);
  const margins = withCurrent(MARGIN_GRID, style.margin);
  const scored: Array<{ m: number; g: number; M: number; err: number }> = [];

  for (const m of mins) {
    // The walk's windows for this minTail: o = m, m+0.02, … (snapTail's steps).
    const walks = samples.map((s) => {
      const floor = s.envelope.floorDb();
      const steps: Array<{ o: number; over: number; fric: boolean }> = [];
      for (let o = m; o <= WALK_LIMIT; o += 0.02) {
        const level = s.envelope.rmsDb(s.wordEnd + o);
        const fric =
          !!style.fricZcr && level > floor + fricMargin && s.envelope.zcr(s.wordEnd + o) >= style.fricZcr;
        steps.push({ o, over: level - floor, fric });
      }
      return steps;
    });
    for (const g of margins) {
      const stops = walks.map((steps) => {
        const hit = steps.find((st) => st.over <= g && !st.fric);
        return hit ? hit.o : Number.POSITIVE_INFINITY;
      });
      for (const M of maxes) {
        if (M < m) continue;
        let err = 0;
        samples.forEach((s, i) => {
          let tail = stops[i] <= M + 1e-9 ? stops[i] : M;
          if (s.gap !== null) tail = Math.min(tail, Math.max(s.gap - head - 0.06, m * 0.5));
          err += Math.abs(ms(tail) - ms(s.user));
        });
        scored.push({ m, g, M, err });
      }
    }
  }

  // ~75k combos: a loop, not Math.min(...spread) (argument-count limit).
  const best = scored.reduce((min, c) => (c.err < min ? c.err : min), Number.POSITIVE_INFINITY);
  const tied = scored.filter((c) => c.err === best);
  const current = tied.find(
    (c) => c.m === style.minTail && c.g === style.margin && c.M === style.maxTail,
  );
  if (current) return { minTail: style.minTail, maxTail: style.maxTail, margin: style.margin };
  const minTail = Math.max(...tied.map((c) => c.m));
  const byMin = tied.filter((c) => c.m === minTail);
  const gs = byMin.map((c) => c.g);
  const margin = nearest(gs, (Math.min(...gs) + Math.max(...gs)) / 2);
  const maxTail = nearest(
    byMin.filter((c) => c.g === margin).map((c) => c.M),
    style.maxTail,
  );
  return { minTail, maxTail, margin };
}

function ms(s: number): number {
  return Math.round(s * 1000);
}

function grid(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) out.push(Math.round((from + i * step) * 1000) / 1000);
  return out;
}

function withCurrent(values: number[], current: number): number[] {
  return values.includes(current) ? values : [...values, current].sort((a, b) => a - b);
}

/** The value in `values` nearest `target` (the smaller one on an exact tie). */
function nearest(values: number[], target: number): number {
  return values.reduce((best, v) =>
    Math.abs(v - target) < Math.abs(best - target) - 1e-12 ? v : best,
  );
}
