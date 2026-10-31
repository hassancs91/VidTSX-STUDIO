// Source-span → timeline-regions: where a span of SOURCE seconds on one asset
// plays on the CURRENT timeline — the intersection of the span with every
// clip that plays that asset (`sourceIn` / `duration`; speed is not applied).
// Shared so the renderer (cut overlay, auditions, shot / insert placement at
// apply) and the main process (insert_asset's cut anchor,
// ASSISTANT_TIMELINE_DESIGN §5) map a span the same way. Moved verbatim in
// behaviour from features/studio/services/cut-proposal.ts.

import type { StudioTimeline } from '../types/studio';

export interface SourceSpan {
  assetId: string;
  /** Source seconds. */
  sourceStart: number;
  sourceEnd: number;
}

export interface SourceSpanRegion {
  trackId: string;
  clipId: string;
  /** Timeline seconds. */
  start: number;
  end: number;
}

/**
 * Every region where `span` plays, ordered by timeline start then track id.
 * A span no clip plays (already trimmed away) yields no regions.
 */
export function mapSourceSpanToTimeline(timeline: StudioTimeline, span: SourceSpan): SourceSpanRegion[] {
  const regions: SourceSpanRegion[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId !== span.assetId) continue;
      const sourceIn = clip.sourceIn ?? 0;
      const from = Math.max(span.sourceStart, sourceIn);
      const to = Math.min(span.sourceEnd, sourceIn + clip.duration);
      if (to - from < 1e-6) continue;
      regions.push({
        trackId: track.id,
        clipId: clip.id,
        start: clip.timelineStart + (from - sourceIn),
        end: clip.timelineStart + (to - sourceIn),
      });
    }
  }
  return regions.sort((a, b) => a.start - b.start || a.trackId.localeCompare(b.trackId));
}
