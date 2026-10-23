// B7 item 4: Auto Cut plans over what is ON the timeline, not the whole
// source. An asset's keeps are the source ranges its media clips still play;
// the spans between them are what applied cuts already removed, so they are
// neither proposed again nor counted in the card's headline. Pure — the Auto
// Cut button derives the keeps from the live timeline, `run_auto_cut` from the
// turn's asset inventory (the renderer fills it from the same timeline), and
// both hand them to the one runner (cut-plan-runner `runCutPlan`).
//
// All times are source-media seconds.

import type { StudioTimeline } from '../types/studio';

export interface CutKeep {
  start: number;
  end: number;
}

/** Keeps closer than this join (a split clip's two halves; one frame of jitter). */
export const KEEP_JOIN_GAP_S = 0.05;

/** Sorted union; spans closer than `gap` join, empty and non-finite ones drop. */
function mergeKeeps(spans: readonly CutKeep[], gap: number): CutKeep[] {
  const sorted = spans
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ start: s.start, end: s.end }))
    .sort((a, b) => a.start - b.start);
  const out: CutKeep[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + gap) last.end = Math.max(last.end, s.end);
    else out.push(s);
  }
  return out;
}

/**
 * The source ranges of `assetId` its video/audio clips play, merged and
 * sorted (`[sourceIn, sourceIn + duration × speed]`, the analysis-track
 * rule). Empty when no clip of the asset is on the timeline.
 */
export function timelineKeepsForAsset(timeline: StudioTimeline, assetId: string): CutKeep[] {
  const spans: CutKeep[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId !== assetId || (clip.kind !== 'video' && clip.kind !== 'audio')) continue;
      const start = clip.sourceIn ?? 0;
      spans.push({ start, end: start + clip.duration * (clip.speed ?? 1) });
    }
  }
  return mergeKeeps(spans, KEEP_JOIN_GAP_S);
}

/**
 * The keeps a plan runs over, clamped to `[0, duration]` and merged — or
 * `undefined` for the whole source: none given, none left after clamping (the
 * asset is not on the timeline), or one keep that covers the source to within
 * `KEEP_JOIN_GAP_S` at both ends (an untouched clip plans exactly as before).
 */
export function normalizeKeeps(
  keeps: readonly CutKeep[] | undefined,
  duration: number,
): CutKeep[] | undefined {
  if (!keeps || keeps.length === 0) return undefined;
  const clamped = mergeKeeps(
    keeps.map((k) => ({ start: Math.max(0, k.start), end: Math.min(duration, k.end) })),
    KEEP_JOIN_GAP_S,
  ).filter((k) => k.end - k.start >= KEEP_JOIN_GAP_S);
  if (clamped.length === 0) return undefined;
  const whole =
    clamped.length === 1 &&
    clamped[0].start <= KEEP_JOIN_GAP_S &&
    clamped[0].end >= duration - KEEP_JOIN_GAP_S;
  return whole ? undefined : clamped;
}

/** The spans between the keeps inside `[0, duration]` — what applied cuts removed. */
export function cutsBetweenKeeps(keeps: readonly CutKeep[], duration: number): CutKeep[] {
  const out: CutKeep[] = [];
  let cursor = 0;
  for (const k of [...keeps].sort((a, b) => a.start - b.start)) {
    if (k.start > cursor) out.push({ start: cursor, end: k.start });
    cursor = Math.max(cursor, k.end);
  }
  if (duration > cursor) out.push({ start: cursor, end: duration });
  return out;
}

/** Seconds the keeps cover. */
export function keepsTotal(keeps: readonly CutKeep[]): number {
  return keeps.reduce((sum, k) => sum + (k.end - k.start), 0);
}

/**
 * A short stable tag for the keeps (ms-rounded, FNV-1a) — part of a
 * keeps-limited plan's file name, so it never shares a file with the
 * whole-source plan of the same style or with another timeline's plan.
 */
export function keepsTag(keeps: readonly CutKeep[]): string {
  const text = keeps.map((k) => `${Math.round(k.start * 1000)}-${Math.round(k.end * 1000)}`).join(',');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `k${hash.toString(36)}`;
}
