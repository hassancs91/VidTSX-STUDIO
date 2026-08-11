// Pure track-level edits, same identity-on-reject contract as timeline-ops:
// a rejected edit returns the SAME timeline object so the reducer skips the
// undo step.

import type { StudioTimeline, StudioTrack, StudioTrackKind } from '../types';

export type TrackFlag = 'locked' | 'muted' | 'hidden';

const NAME_PREFIX: Record<StudioTrackKind, string> = {
  video: 'V',
  overlay: 'O',
  audio: 'A',
  caption: 'C',
};

export function makeTrackId(): string {
  return `track_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Next free default name for a kind: V2 after V1, O1 when none exist… */
function nextTrackName(tracks: StudioTrack[], kind: StudioTrackKind): string {
  const pattern = new RegExp(`^${NAME_PREFIX[kind]}(\\d+)$`, 'i');
  const top = tracks.reduce((max, t) => {
    const match = pattern.exec(t.name);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${NAME_PREFIX[kind]}${top + 1}`;
}

/**
 * Add an empty track. Visual tracks (video/overlay) go on TOP — tracks[0]
 * paints last in TimelineComposition, so "above" in the UI means "in front"
 * in the picture. Audio only mixes, so it appends at the bottom.
 */
export function addTrack(
  timeline: StudioTimeline,
  kind: StudioTrackKind,
  id: string = makeTrackId(),
): StudioTimeline {
  const track: StudioTrack = {
    id,
    kind,
    name: nextTrackName(timeline.tracks, kind),
    clips: [],
  };
  return {
    ...timeline,
    tracks: kind === 'audio' ? [...timeline.tracks, track] : [track, ...timeline.tracks],
  };
}

export function renameTrack(
  timeline: StudioTimeline,
  trackId: string,
  name: string,
): StudioTimeline {
  const trimmed = name.trim();
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || !trimmed || track.name === trimmed) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => (t.id === trackId ? { ...t, name: trimmed } : t)),
  };
}

/** Swap a track with its neighbour above (-1) or below (+1). */
export function moveTrack(
  timeline: StudioTimeline,
  trackId: string,
  direction: -1 | 1,
): StudioTimeline {
  const index = timeline.tracks.findIndex((t) => t.id === trackId);
  if (index < 0) return timeline;
  const target = index + direction;
  if (target < 0 || target >= timeline.tracks.length) return timeline;
  const tracks = [...timeline.tracks];
  [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
  return { ...timeline, tracks };
}

/** Delete a track, clips included. Locked tracks and the last track reject. */
export function removeTrack(timeline: StudioTimeline, trackId: string): StudioTimeline {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || track.locked || timeline.tracks.length <= 1) return timeline;
  return { ...timeline, tracks: timeline.tracks.filter((t) => t.id !== trackId) };
}

export function setTrackFlag(
  timeline: StudioTimeline,
  trackId: string,
  flag: TrackFlag,
  value: boolean,
): StudioTimeline {
  const track = timeline.tracks.find((t) => t.id === trackId);
  if (!track || Boolean(track[flag]) === value) return timeline;
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) => (t.id === trackId ? { ...t, [flag]: value } : t)),
  };
}
