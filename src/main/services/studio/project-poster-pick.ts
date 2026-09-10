import type { StudioMediaAsset, StudioProject } from '../../../shared/types/studio';
import { timelineDuration } from '../../../shared/studio/time-math';

// Pure half of the poster (V1 completion plan §2.6): WHICH frame represents a
// project. Kept free of I/O so the choice is unit-tested and the ffmpeg half
// stays a few lines.

/** Where on the timeline the poster frame is taken from (a fraction). */
export const POSTER_TIMELINE_FRACTION = 0.1;

export interface PosterSource {
  asset: StudioMediaAsset;
  /** Seconds into the SOURCE media (proxy and original share the time base). */
  sourceTime: number;
}

/**
 * The first video clip on the top-most video track, at 10 % of the timeline:
 * the clip under that point when one is there, else the track's earliest
 * clip at 10 % of its own length. Null when the project has no video clip —
 * the card then draws the placeholder, and no file is written.
 */
export function pickPosterSource(project: StudioProject): PosterSource | null {
  const track = project.timeline.tracks.find((t) => t.kind === 'video');
  if (!track) return null;
  const assetsById = new Map(project.assets.map((a) => [a.id, a]));
  const clips = track.clips
    .filter((c) => c.kind === 'video' && c.assetId && assetsById.get(c.assetId)?.kind === 'video')
    .sort((a, b) => a.timelineStart - b.timelineStart);
  if (clips.length === 0) return null;

  const point = timelineDuration(project.timeline) * POSTER_TIMELINE_FRACTION;
  const covering = clips.find(
    (c) => c.timelineStart <= point && point < c.timelineStart + c.duration,
  );
  const clip = covering ?? clips[0];
  const offset = covering ? point - clip.timelineStart : clip.duration * POSTER_TIMELINE_FRACTION;
  const asset = assetsById.get(clip.assetId as string) as StudioMediaAsset;
  const sourceTime = Math.max(0, (clip.sourceIn ?? 0) + offset * (clip.speed ?? 1));
  return { asset, sourceTime };
}

/** What a poster was made from — equal signatures mean the file is current. */
export function posterSignature(source: PosterSource | null, sourceFile: string | null): string {
  if (!source || !sourceFile) return 'none';
  return `${sourceFile}|${source.sourceTime.toFixed(3)}`;
}
