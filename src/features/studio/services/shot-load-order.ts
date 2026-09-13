import type { StudioTimeline } from '../types';

/** Where one shot plays on the timeline (a shot can play in several clips). */
export interface ShotSpan {
  shotId: string;
  start: number;
  end: number;
}

export function shotSpans(timeline: StudioTimeline): ShotSpan[] {
  const spans: ShotSpan[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.tsx) continue;
      spans.push({ shotId: clip.tsx.shotId, start: clip.timelineStart, end: clip.timelineStart + clip.duration });
    }
  }
  return spans;
}

/** Seconds from the playhead to the nearest of a shot's spans (0 inside one). */
function distanceToPlayhead(spans: ShotSpan[], playhead: number): { distance: number; ahead: boolean } {
  let best = { distance: Number.POSITIVE_INFINITY, ahead: false };
  for (const span of spans) {
    const ahead = span.start >= playhead;
    const distance = playhead >= span.start && playhead < span.end ? 0 : ahead ? span.start - playhead : playhead - span.end;
    if (distance < best.distance || (distance === best.distance && ahead && !best.ahead)) {
      best = { distance, ahead };
    }
  }
  return best;
}

/**
 * The order to load shot modules in when a project opens (video-10 feedback
 * item 2): what is under the playhead first, then outward by distance — a tie
 * goes to the shot AHEAD of the playhead, since that is what plays next.
 * Shots that are in the pool but on no clip load last, in the given order.
 */
export function orderShotLoads(shotIds: readonly string[], spans: readonly ShotSpan[], playhead: number): string[] {
  const byShot = new Map<string, ShotSpan[]>();
  for (const span of spans) {
    const list = byShot.get(span.shotId) ?? [];
    list.push(span);
    byShot.set(span.shotId, list);
  }
  return shotIds
    .map((id, index) => ({ id, index, ...distanceToPlayhead(byShot.get(id) ?? [], playhead) }))
    .sort((a, b) => a.distance - b.distance || Number(b.ahead) - Number(a.ahead) || a.index - b.index)
    .map((entry) => entry.id);
}
