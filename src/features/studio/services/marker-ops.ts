// Timeline-marker edits — split out of timeline-ops.ts (structural clip edits)
// to keep both files under the ~300-line house rule. Same contract: pure,
// identity-on-reject, and the markers array stays sorted by time. A timeline
// with zero markers has NO `markers` key, so old documents round-trip
// byte-identical.
//
// All times are seconds — see docs/studio/PLAN.md §4.

import type { StudioMarker, StudioTimeline } from '../types';

export function makeMarkerId(): string {
  return `marker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortByTime(markers: StudioMarker[]): StudioMarker[] {
  return [...markers].sort((a, b) => a.time - b.time);
}

/** Replace the marker list, dropping the key entirely when it empties. */
function withMarkers(timeline: StudioTimeline, markers: StudioMarker[]): StudioTimeline {
  if (markers.length === 0) {
    const next = { ...timeline };
    delete next.markers;
    return next;
  }
  return { ...timeline, markers: sortByTime(markers) };
}

/** Drop a marker at `time` (clamped ≥ 0). The id is minted by the caller so
 *  dispatch stays deterministic; an already-used id rejects. */
export function addMarker(
  timeline: StudioTimeline,
  id: string,
  time: number,
  label?: string,
): StudioTimeline {
  if (!Number.isFinite(time)) return timeline;
  const markers = timeline.markers ?? [];
  if (markers.some((m) => m.id === id)) return timeline;
  const marker: StudioMarker = { id, time: Math.max(0, time) };
  const trimmed = label?.trim();
  if (trimmed) marker.label = trimmed;
  return withMarkers(timeline, [...markers, marker]);
}

/** Drag a marker to a new time (clamped ≥ 0). */
export function moveMarker(
  timeline: StudioTimeline,
  markerId: string,
  time: number,
): StudioTimeline {
  if (!Number.isFinite(time)) return timeline;
  const markers = timeline.markers ?? [];
  const found = markers.find((m) => m.id === markerId);
  if (!found) return timeline;
  const clamped = Math.max(0, time);
  if (clamped === found.time) return timeline;
  return withMarkers(
    timeline,
    markers.map((m) => (m.id === markerId ? { ...m, time: clamped } : m)),
  );
}

export function removeMarker(timeline: StudioTimeline, markerId: string): StudioTimeline {
  const markers = timeline.markers ?? [];
  if (!markers.some((m) => m.id === markerId)) return timeline;
  return withMarkers(
    timeline,
    markers.filter((m) => m.id !== markerId),
  );
}

/** Set a marker's label; an empty label removes the key (normalized form,
 *  like gain 1 or a zero fade — documents never accumulate no-op state). */
export function renameMarker(
  timeline: StudioTimeline,
  markerId: string,
  label: string,
): StudioTimeline {
  const markers = timeline.markers ?? [];
  const found = markers.find((m) => m.id === markerId);
  if (!found) return timeline;
  const trimmed = label.trim();
  if ((found.label ?? '') === trimmed) return timeline;
  return withMarkers(
    timeline,
    markers.map((m) => {
      if (m.id !== markerId) return m;
      const next = { ...m };
      if (trimmed === '') delete next.label;
      else next.label = trimmed;
      return next;
    }),
  );
}
