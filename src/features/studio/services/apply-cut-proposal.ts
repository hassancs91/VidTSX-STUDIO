// Applying a cut proposal: subtract every ACCEPTED cut span from the clips
// that play the asset, keep the survivors contiguous (per-track ripple, same
// semantics as removeClip(ripple) — other tracks hold their timing), and tag
// the reshaped clips with agent provenance. Pure; one call = one undo step.
//
// With `rippleAllTracks` (the toolbar's ripple mode) every span the MASTER
// lane loses is also taken out of the tracks that don't play a cut asset —
// shots placed against the footage stay aligned with it (ripple-ops.ts).
//
// Cut spans are SOURCE seconds; clips map them through sourceIn/duration.

import { masterLane } from '@shared/studio';
import type { StudioClip, StudioProposal, StudioTimeline } from '../types';
import { MIN_CLIP_DURATION, makeClipId } from './timeline-ops';
import { cutSpanFromClips, cutSpanFromMarkers } from './ripple-ops';

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

/** The clip's timeline spans that are NOT in `pieces` — what a cut removes. */
function removedTimelineSpans(clip: StudioClip, pieces: Span[]): Span[] {
  const sourceIn = clip.sourceIn ?? 0;
  const spans: Span[] = [];
  let cursor = sourceIn;
  for (const piece of pieces) {
    if (piece.start - cursor > 1e-9) {
      spans.push({
        start: clip.timelineStart + (cursor - sourceIn),
        end: clip.timelineStart + (piece.start - sourceIn),
      });
    }
    cursor = piece.end;
  }
  if (sourceIn + clip.duration - cursor > 1e-9) {
    spans.push({
      start: clip.timelineStart + (cursor - sourceIn),
      end: clip.timelineStart + clip.duration,
    });
  }
  return spans;
}

/** Take the master lane's removed spans out of every other unlocked track (and the markers). */
function followMasterSpans(
  result: StudioTimeline,
  spans: Span[],
  skipTrackIds: ReadonlySet<string>,
): StudioTimeline {
  // Latest first: the earlier spans still sit at their original seconds.
  const ordered = [...spans].sort((a, b) => b.start - a.start);
  const tracks = result.tracks.map((track) => {
    if (track.locked || skipTrackIds.has(track.id)) return track;
    let clips = track.clips;
    let touched = false;
    for (const span of ordered) {
      const cut = cutSpanFromClips(clips, span.start, span.end);
      if (cut.changed) {
        clips = cut.clips;
        touched = true;
      }
    }
    return touched ? { ...track, clips } : track;
  });
  let markers = result.markers;
  if (markers && markers.length > 0) {
    for (const span of ordered) {
      const cut = cutSpanFromMarkers(markers, span.start, span.end);
      if (cut.changed) markers = cut.markers;
    }
  }
  return { ...result, tracks, ...(markers !== result.markers ? { markers } : {}) };
}

export interface ApplyCutOptions {
  /** Ripple every unlocked track along with the master lane (useRippleMode 'all'). */
  rippleAllTracks?: boolean;
}

/**
 * Apply the proposal's accepted cuts. Returns the SAME timeline object when
 * nothing changes (no accepted items, or no clips play the cut assets) — the
 * reducer treats identity as "rejected edit, no history entry".
 */
export function applyCutProposal(
  timeline: StudioTimeline,
  proposal: StudioProposal,
  options: ApplyCutOptions = {},
): StudioTimeline {
  const byAsset = acceptedSpansByAsset(proposal);
  if (byAsset.size === 0) return timeline;

  const master = masterLane(timeline);
  const masterSpans: Span[] = [];
  const affectedIds = new Set<string>();
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    if (track.locked) return track;
    const affected = track.clips.some((c) => c.assetId && byAsset.has(c.assetId));
    if (!affected) return track;
    affectedIds.add(track.id);

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
      if (master && track.id === master.id) {
        masterSpans.push(...removedTimelineSpans(clip, pieces));
      }
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

  if (!changed) return timeline;
  const result = { ...timeline, tracks };
  if (!options.rippleAllTracks || masterSpans.length === 0) return result;
  return followMasterSpans(result, masterSpans, affectedIds);
}
