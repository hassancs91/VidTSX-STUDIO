import type { StudioMediaAsset, StudioShot, StudioTimeline } from '../types';

/**
 * Where a media asset (or a shot) is used in the open project — the numbers
 * behind the "on timeline" badge and the remove-anyway confirm (feedback
 * item 6). Pure: counts only, no document changes.
 */
export interface AssetUsage {
  /** Clips playing the asset, on every track. */
  clips: number;
  /** Per-track breakdown in track order; tracks with no clips are omitted. */
  tracks: Array<{ trackId: string; name: string; count: number }>;
  /** Shots that reference the asset through `assetRefs`. */
  shots: number;
}

export const NO_USAGE: AssetUsage = { clips: 0, tracks: [], shots: 0 };

export function isAssetUsed(usage: AssetUsage): boolean {
  return usage.clips > 0 || usage.shots > 0;
}

/** Usage of every asset that appears somewhere; absent = unused. */
export function usageByAsset(
  timeline: StudioTimeline,
  shots: StudioShot[],
): Map<string, AssetUsage> {
  const map = new Map<string, AssetUsage>();
  const entry = (assetId: string): AssetUsage => {
    let u = map.get(assetId);
    if (!u) {
      u = { clips: 0, tracks: [], shots: 0 };
      map.set(assetId, u);
    }
    return u;
  };
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue;
      const u = entry(clip.assetId);
      u.clips += 1;
      const last = u.tracks[u.tracks.length - 1];
      if (last && last.trackId === track.id) last.count += 1;
      else u.tracks.push({ trackId: track.id, name: track.name, count: 1 });
    }
  }
  for (const shot of shots) {
    const refs = new Set(Object.values(shot.assetRefs ?? {}));
    for (const assetId of refs) entry(assetId).shots += 1;
  }
  return map;
}

/** Clip count per shot id for the shots on the timeline; absent = unused. */
export function usageByShot(timeline: StudioTimeline): Map<string, number> {
  const map = new Map<string, number>();
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const shotId = clip.tsx?.shotId;
      if (shotId) map.set(shotId, (map.get(shotId) ?? 0) + 1);
    }
  }
  return map;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Used by 297 clips on V1 and 2 shots." — empty string when unused. */
export function describeAssetUsage(usage: AssetUsage): string {
  const parts: string[] = [];
  if (usage.clips > 0) {
    parts.push(`${plural(usage.clips, 'clip')} on ${joinNames(usage.tracks.map((t) => t.name))}`);
  }
  if (usage.shots > 0) parts.push(plural(usage.shots, 'shot'));
  return parts.length === 0 ? '' : `Used by ${joinNames(parts)}.`;
}

/** "Used by 3 clips on the timeline." — empty string when unused. */
export function describeShotUsage(clips: number): string {
  return clips > 0 ? `Used by ${plural(clips, 'clip')} on the timeline.` : '';
}

/** The asset's file name, for the confirm card's title. */
export function assetFileName(asset: StudioMediaAsset): string {
  return asset.path.split(/[\\/]/).pop() ?? asset.path;
}
