// cutlib's `min_skip` merge (tools/cutlib.py plan_clip), split out of the
// cut planner. Pure.

import type { CutPlanSegment } from '../types/studio-cut-plan';

interface Span {
  start: number;
  end: number;
}

/**
 * cutlib's `min_skip` merge: join a segment to the previous one when the
 * stretch skipped between them is shorter than `minSkip` (or they overlap —
 * a snapped lead-in can reach back past the previous tail), unless an
 * explicit cut lies between them. The gap clamp always leaves a 60 ms hole
 * between atoms; when the ASR pause is fake (a 50 ms "why" token over a
 * 0.4 s "whyyy") that hole drops speech.
 */
export function mergeShortSkips(
  segments: CutPlanSegment[],
  minSkip: number,
  cuts: Span[] = [],
): CutPlanSegment[] {
  const merged: CutPlanSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      seg.start - prev.end < minSkip &&
      !cuts.some((c) => c.start < seg.start && c.end > prev.end)
    ) {
      const laterEnd = seg.end >= prev.end;
      merged[merged.length - 1] = {
        start: prev.start,
        end: Math.max(prev.end, seg.end),
        speechStart: prev.speechStart,
        speechEnd: Math.max(prev.speechEnd, seg.speechEnd),
        soft: laterEnd ? seg.soft : prev.soft,
      };
    } else {
      merged.push(seg);
    }
  }
  return merged;
}
