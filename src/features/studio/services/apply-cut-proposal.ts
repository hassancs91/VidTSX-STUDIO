// Applying a cut proposal: subtract every ACCEPTED cut span from the clips
// that play the asset, keep the survivors contiguous (per-track ripple, same
// semantics as removeClip(ripple) — other tracks hold their timing), and tag
// the reshaped clips with agent provenance. Pure; one call = one undo step.
//
// Cut spans are SOURCE seconds; clips map them through sourceIn/duration.

import type { StudioClip, StudioProposal, StudioTimeline } from '../types';
import { MIN_CLIP_DURATION, makeClipId } from './timeline-ops';

interface Span {
  start: number;
  end: number;
}

/** Merge overlapping/touching spans (user-adjusted edges may collide). */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end + 1e-6) last.end = Math.max(last.end, span.end);
    else merged.push({ ...span });
  }
  return merged;
}

/** Accepted cut spans per asset, merged. */
function acceptedSpansByAsset(proposal: StudioProposal): Map<string, Span[]> {
  const byAsset = new Map<string, Span[]>();
  for (const item of proposal.items) {
    if (item.status !== 'accepted') continue;
    if (!item.assetId || item.sourceStart === undefined || item.sourceEnd === undefined) continue;
    if (item.sourceEnd - item.sourceStart < 1e-6) continue;
    const list = byAsset.get(item.assetId) ?? [];
    list.push({ start: item.sourceStart, end: item.sourceEnd });
    byAsset.set(item.assetId, list);
  }
  for (const [assetId, spans] of byAsset) byAsset.set(assetId, mergeSpans(spans));
  return byAsset;
}

/** The clip's source range minus the cut spans, in source seconds. */
function keptPieces(sourceIn: number, sourceEnd: number, cuts: Span[]): Span[] {
  const pieces: Span[] = [];
  let cursor = sourceIn;
  for (const cut of cuts) {
    if (cut.end <= sourceIn || cut.start >= sourceEnd) continue;
    const from = Math.max(cut.start, sourceIn);
    if (from - cursor >= MIN_CLIP_DURATION) pieces.push({ start: cursor, end: from });
    cursor = Math.max(cursor, Math.min(cut.end, sourceEnd));
  }
  if (sourceEnd - cursor >= MIN_CLIP_DURATION) pieces.push({ start: cursor, end: sourceEnd });
  return pieces;
}

/**
 * Apply the proposal's accepted cuts. Returns the SAME timeline object when
 * nothing changes (no accepted items, or no clips play the cut assets) — the
 * reducer treats identity as "rejected edit, no history entry".
 */
export function applyCutProposal(
  timeline: StudioTimeline,
  proposal: StudioProposal,
): StudioTimeline {
  const byAsset = acceptedSpansByAsset(proposal);
  if (byAsset.size === 0) return timeline;

  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (track.locked) return track;
    const affected = track.clips.some((c) => c.assetId && byAsset.has(c.assetId));
    if (!affected) return track;

    const next: StudioClip[] = [];
    let shift = 0;
    for (const clip of [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart)) {
      const cuts = clip.assetId ? byAsset.get(clip.assetId) : undefined;
      const newStart = Math.max(0, clip.timelineStart - shift);
      if (!cuts) {
        next.push(shift > 0 ? { ...clip, timelineStart: newStart } : clip);
        continue;
      }
      const sourceIn = clip.sourceIn ?? 0;
      const pieces = keptPieces(sourceIn, sourceIn + clip.duration, cuts);
      const kept = pieces.reduce((sum, p) => sum + (p.end - p.start), 0);
      if (pieces.length === 1 && Math.abs(kept - clip.duration) < 1e-6) {
        // Untouched by any cut — only the ripple shift applies.
        next.push(shift > 0 ? { ...clip, timelineStart: newStart } : clip);
        continue;
      }
      changed = true;
      let cursor = newStart;
      pieces.forEach((piece, index) => {
        next.push({
          ...clip,
          id: index === 0 ? clip.id : makeClipId(),
          timelineStart: cursor,
          duration: piece.end - piece.start,
          sourceIn: piece.start,
          origin: { by: 'agent', proposalId: proposal.id },
        });
        cursor += piece.end - piece.start;
      });
      shift += clip.duration - kept;
    }
    if (shift > 0) changed = true;
    return { ...track, clips: next };
  });

  return changed ? { ...timeline, tracks } : timeline;
}
