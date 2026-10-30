// insert_asset's cut anchor (ASSISTANT_TIMELINE_DESIGN §5): `{ cut, offset? }`
// → where the insert lands. Pure. The cut is §2's (timeline-cuts — the same
// numbers get_timeline prints). The point `t = cut time + offset` lies in the
// clip after the cut (offset ≥ 0) or before it (offset < 0). On a footage
// clip the insert is ANCHORED to that footage's source second — it follows
// later trims and ripples until applied — but only when the shared
// source→timeline mapping (what the renderer does at apply) puts the span's
// first region exactly at `t`; otherwise (speed ≠ 1, the same source played
// earlier, an image / TSX side) it is the fixed `{ timelineStart: t }`.

import type { StudioClip, StudioTimeline } from '../../../../shared/types/studio';
import { formatTimelineTc, masterTimelineModel } from '../../../../shared/studio/timeline-cuts';
import { mapSourceSpanToTimeline } from '../../../../shared/studio/source-span-map';

export interface CutAnchorRequest {
  /** The n-th cut on the master track, 1 = the first. */
  cut: number;
  /** Seconds from the cut; negative = before it (default 0). */
  offset?: number;
}

export type CutAnchorAt = { anchorAssetId: string; sourceStart: number } | { timelineStart: number };

export type CutAnchorResult =
  | { ok: true; /** Timeline seconds of the point. */ t: number; at: CutAnchorAt; atLabel: string }
  | { ok: false; error: string };

/** How close (s) the mapped start must land to `t` for the anchor to be kept. */
const MAP_EPS = 0.001;

const FOOTAGE_KINDS = new Set<StudioClip['kind']>(['video', 'audio', 'sfx']);

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The headline's placement words, e.g. "0.25 s before cut 1 (0:02.75 on the timeline)". */
export function cutAnchorLabel(cut: number, offset: number, t: number): string {
  const where = `(${formatTimelineTc(t)} on the timeline)`;
  if (offset < 0) return `${Math.abs(offset).toFixed(2)} s before cut ${cut} ${where}`;
  if (offset > 0) return `${offset.toFixed(2)} s after cut ${cut} ${where}`;
  return `at cut ${cut} ${where}`;
}

/** The footage candidate on `side`, kept only when the mapping lands it at `t`. */
function footageAnchor(
  timeline: StudioTimeline,
  side: StudioClip,
  offset: number,
  t: number,
  clipDuration: number,
): CutAnchorAt | null {
  if (!side.assetId || side.tsx || !FOOTAGE_KINDS.has(side.kind)) return null;
  const into = offset >= 0 ? offset : side.duration + offset;
  const sourceStart = round3((side.sourceIn ?? 0) + into * (side.speed ?? 1));
  const regions = mapSourceSpanToTimeline(timeline, {
    assetId: side.assetId,
    sourceStart,
    sourceEnd: sourceStart + clipDuration,
  });
  if (regions.length === 0 || Math.abs(regions[0].start - t) > MAP_EPS) return null;
  return { anchorAssetId: side.assetId, sourceStart };
}

/**
 * Resolve `{ cut, offset }` on `timeline` for an inserted clip of
 * `clipDuration` seconds (its final, clipped length).
 */
export function resolveCutAnchor(
  timeline: StudioTimeline,
  request: CutAnchorRequest,
  clipDuration: number,
): CutAnchorResult {
  const model = masterTimelineModel(timeline);
  const cuts = model?.cuts ?? [];
  if (!model || cuts.length === 0) {
    const name = model ? ` "${model.track.name}"` : '';
    return {
      ok: false,
      error: `There is no cut on the master track${name} (0 cuts) — pass \`at\` as timeline seconds or { word, take }.`,
    };
  }
  const n = request.cut;
  const found = cuts.find((c) => c.n === n);
  if (!found) {
    return {
      ok: false,
      error: `The master track "${model.track.name}" has ${plural(cuts.length, 'cut')} — cut ${n} does not exist (cuts count from 1 in timeline order; get_timeline lists them).`,
    };
  }
  const offset = request.offset ?? 0;
  const after = offset >= 0;
  const side = after ? found.right : found.left;
  const inside = after ? offset < side.duration : -offset <= side.duration;
  if (!inside) {
    const which = after ? 'after' : 'before';
    return {
      ok: false,
      error: `${Math.abs(offset).toFixed(2)} s ${which} cut ${n} is outside the clip ${which} it (${side.duration.toFixed(2)} s long) — pass \`at\` as timeline seconds instead.`,
    };
  }
  const t = found.time + offset;
  const at = footageAnchor(timeline, side, offset, t, clipDuration) ?? { timelineStart: t };
  return { ok: true, t, at, atLabel: cutAnchorLabel(n, offset, t) };
}
