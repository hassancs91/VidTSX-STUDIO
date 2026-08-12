// Timeline document (seconds) → Remotion composition input (frames + URLs).
//
// The same serializer feeds the editor's <Player> and the export render; only
// the URL resolver differs (720p proxies for preview, originals for export),
// which is what makes "what you scrub is what renders" true.

import type {
  StudioClipKind,
  StudioClipTransform,
  StudioProject,
  StudioTrackKind,
} from '../types/studio';
import { spanToFrames, timeToFrame, timelineDurationInFrames } from './time-math';

export interface SerializedClip {
  id: string;
  kind: StudioClipKind;
  /** Absolute frame on the timeline where the clip starts. */
  from: number;
  durationInFrames: number;
  /** Frames into the source media (Remotion's `trimBefore`). */
  trimBefore?: number;
  /** Resolved http URL of the media, or null when the asset is missing. */
  src?: string;
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  /** Audio fade ramp lengths in composition frames (Slice C1). */
  fadeInFrames?: number;
  fadeOutFrames?: number;
  transform?: StudioClipTransform;
}

export interface SerializedTrack {
  id: string;
  kind: StudioTrackKind;
  clips: SerializedClip[];
}

export interface SerializedTimeline {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** UI order, top lane first. Painting is reverse order — see TimelineComposition. */
  tracks: SerializedTrack[];
}

/** Maps an assetId to a URL the Player/renderer can fetch, or null if missing. */
export type AssetUrlResolver = (assetId: string) => string | null;

export function serializeTimeline(
  project: StudioProject,
  resolveUrl: AssetUrlResolver,
): SerializedTimeline {
  const { fps, width, height } = project.settings;

  const tracks: SerializedTrack[] = [];
  for (const track of project.timeline.tracks) {
    // A hidden track drops its picture; audio-only tracks have nothing to hide.
    if (track.hidden && track.kind !== 'audio') continue;

    const clips: SerializedClip[] = [];
    for (const clip of track.clips) {
      const durationInFrames = spanToFrames(
        clip.timelineStart,
        clip.timelineStart + clip.duration,
        fps,
      );
      if (durationInFrames <= 0) continue;

      const src = clip.assetId ? resolveUrl(clip.assetId) : null;
      // Media clips with no resolvable source would render a Remotion error
      // overlay mid-timeline; skipping keeps the rest of the edit playable.
      if (!src && clip.kind !== 'tsx' && clip.kind !== 'caption') continue;

      // Fades are durations, not positions — plain rounding, clamped so the
      // ramps never overlap even after frame quantization.
      const fadeInFrames = Math.min(Math.round((clip.fadeInSec ?? 0) * fps), durationInFrames);
      const fadeOutFrames = Math.min(
        Math.round((clip.fadeOutSec ?? 0) * fps),
        durationInFrames - fadeInFrames,
      );

      clips.push({
        id: clip.id,
        kind: clip.kind,
        from: timeToFrame(clip.timelineStart, fps),
        durationInFrames,
        ...(clip.sourceIn ? { trimBefore: timeToFrame(clip.sourceIn, fps) } : {}),
        ...(src ? { src } : {}),
        ...(clip.gain !== undefined ? { volume: clip.gain } : {}),
        ...(track.muted ? { muted: true } : {}),
        ...(clip.speed !== undefined && clip.speed !== 1 ? { playbackRate: clip.speed } : {}),
        ...(fadeInFrames > 0 ? { fadeInFrames } : {}),
        ...(fadeOutFrames > 0 ? { fadeOutFrames } : {}),
        ...(clip.transform ? { transform: clip.transform } : {}),
      });
    }
    tracks.push({ id: track.id, kind: track.kind, clips });
  }

  return {
    width,
    height,
    fps,
    durationInFrames: timelineDurationInFrames(project.timeline, fps),
    tracks,
  };
}
