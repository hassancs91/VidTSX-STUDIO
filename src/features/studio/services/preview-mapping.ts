// Preview-result time mapping. While "Preview result" is on, the Player
// plays the CUT timeline (shorter) but the timeline panel still displays the
// ORIGINAL one with striped regions — so the playhead must translate between
// the two clocks: display positions jump over cut regions instead of
// crawling through them, and ruler seeks land on the equivalent result time.
//
// The map follows the affected track (the one the cuts reshaped): each
// result clip is a linear segment source-aligned with its original clip.

import type { StudioTimeline } from '../types';

interface Segment {
  resultStart: number;
  originalStart: number;
  duration: number;
}

export interface PreviewTimeMap {
  /** Result-timeline seconds → original-timeline seconds (for the playhead). */
  toOriginal(seconds: number): number;
  /** Original-timeline seconds → result seconds (for seeks; cut spans land on the join). */
  toResult(seconds: number): number;
}

/**
 * Build the map from the original timeline and its cut result. Returns null
 * when no track differs (nothing to translate). Segments come from the first
 * reshaped track — per-track ripple means unaffected tracks keep their clock.
 */
export function buildPreviewTimeMap(
  original: StudioTimeline,
  result: StudioTimeline,
): PreviewTimeMap | null {
  const segments: Segment[] = [];
  for (let i = 0; i < original.tracks.length && segments.length === 0; i++) {
    const before = original.tracks[i];
    const after = result.tracks.find((t) => t.id === before.id);
    if (!after || after.clips === before.clips) continue;
    for (const clip of [...after.clips].sort((a, b) => a.timelineStart - b.timelineStart)) {
      if (!clip.assetId) continue;
      const sourceIn = clip.sourceIn ?? 0;
      const origin = before.clips.find(
        (c) =>
          c.assetId === clip.assetId &&
          sourceIn >= (c.sourceIn ?? 0) - 1e-6 &&
          sourceIn < (c.sourceIn ?? 0) + c.duration,
      );
      if (!origin) continue;
      segments.push({
        resultStart: clip.timelineStart,
        originalStart: origin.timelineStart + (sourceIn - (origin.sourceIn ?? 0)),
        duration: clip.duration,
      });
    }
  }
  if (segments.length === 0) return null;
  segments.sort((a, b) => a.resultStart - b.resultStart);

  // Piecewise-linear in both directions. Between segments, a preserved gap
  // (same width on both sides) maps proportionally; a collapsed gap (a cut —
  // zero width on the result side) becomes the jump the user sees.
  const map = (t: number, from: 'result' | 'original'): number => {
    const lo = (s: Segment) => (from === 'result' ? s.resultStart : s.originalStart);
    const hi = (s: Segment) => (from === 'result' ? s.originalStart : s.resultStart);
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (t <= lo(first)) return Math.max(0, hi(first) - (lo(first) - t));
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (t <= lo(seg) + seg.duration) return hi(seg) + (t - lo(seg));
      const next = segments[i + 1];
      if (!next) break;
      if (t < lo(next)) {
        const gap = lo(next) - (lo(seg) + seg.duration);
        const targetGap = hi(next) - (hi(seg) + seg.duration);
        const fraction = gap > 1e-9 ? (t - (lo(seg) + seg.duration)) / gap : 1;
        return hi(seg) + seg.duration + fraction * targetGap;
      }
    }
    return hi(last) + Math.min(Math.max(t - lo(last), 0), last.duration);
  };

  return {
    toOriginal: (seconds) => map(seconds, 'result'),
    toResult: (seconds) => map(seconds, 'original'),
  };
}
