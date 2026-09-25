// Export pre-flight for analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks"): the faces track of every asset a tracked filter is
// applied to is copied beside the entry as JSON and statically imported, so
// the render reads the SAME frames the Player painted from. A clip whose
// track is missing or still incomplete stops the export with a readable
// error — the editor refuses earlier (the chip), this is the backstop for
// every other way an export can start.

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { FACE_TRACK_REQUIREMENT } from '../../../shared/studio/filter-pack';
import { faceTrackRelPath, parseFaceTrack, spansCovered, type TrackSpan } from '../../../shared/studio/face-track';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import { trackEntryRefs, type ShotEntryRef } from '../../../shared/studio/shot-export';
import { getProjectCacheDir } from './studio-paths';
import { listFilters } from './filter-packs';

export interface PreparedTrack {
  assetId: string;
  ref: ShotEntryRef;
  /** The cache file's text, verbatim. */
  json: string;
  /** Of `json` — goes into the entry so the bundle cache follows the track. */
  sha256: string;
}

/** Asset id → the source spans its filtered clips play, from the serialized timeline. */
export function trackedSpans(serialized: Pick<SerializedTimeline, 'tracks' | 'fps'>, needsTrack: (kind: string) => boolean): Map<string, { spans: TrackSpan[]; clipIds: string[] }> {
  const out = new Map<string, { spans: TrackSpan[]; clipIds: string[] }>();
  for (const track of serialized.tracks) {
    for (const clip of track.clips) {
      if ((clip.kind !== 'video' && clip.kind !== 'image') || !clip.assetId || !clip.effects?.some((e) => needsTrack(e.kind))) continue;
      const start = (clip.trimBefore ?? 0) / serialized.fps;
      const span: TrackSpan = clip.kind === 'image' ? [0, 0] : [start, start + (clip.durationInFrames * (clip.playbackRate ?? 1)) / serialized.fps];
      const entry = out.get(clip.assetId) ?? { spans: [], clipIds: [] };
      entry.spans.push(span);
      entry.clipIds.push(clip.id);
      out.set(clip.assetId, entry);
    }
  }
  return out;
}

/**
 * One JSON copy per asset the timeline's tracked filters read. Throws when a
 * track is absent or does not cover a clip: the export must not start.
 */
export async function prepareFaceTracks(projectId: string, serialized: Pick<SerializedTimeline, 'tracks' | 'fps'>): Promise<PreparedTrack[]> {
  const installed = new Map((await listFilters()).map((item) => [item.kind, item]));
  const needed = trackedSpans(serialized, (kind) => installed.get(kind)?.requires.includes(FACE_TRACK_REQUIREMENT) ?? false);
  if (needed.size === 0) return [];

  const cacheDir = await getProjectCacheDir(projectId);
  const assetIds = [...needed.keys()].sort();
  const refs = trackEntryRefs(assetIds, projectId);
  const out: PreparedTrack[] = [];
  for (let i = 0; i < assetIds.length; i++) {
    const assetId = assetIds[i];
    const { spans, clipIds } = needed.get(assetId)!;
    let json: string;
    try {
      json = await fs.readFile(path.join(cacheDir, ...faceTrackRelPath(assetId).split('/')), 'utf-8');
    } catch {
      throw new Error(`Face analysis has not run for clip ${clipIds[0]} — apply the filter in the editor and wait for its chip to reach 100%, then export.`);
    }
    const track = parseFaceTrack(JSON.parse(json) as unknown);
    if (!track) throw new Error(`The face track of clip ${clipIds[0]} is unreadable — remove and re-apply the filter to analyse it again.`);
    const covered = track.static || spansCovered(track.spans, spans, 1 / Math.max(1, track.fps));
    if (!covered) throw new Error(`Face analysis is still incomplete for clip ${clipIds[0]} — wait for its chip to reach 100%, then export.`);
    out.push({ assetId, ref: refs[i], json, sha256: createHash('sha256').update(json).digest('hex') });
  }
  return out;
}

/** The entry's import lines and the `tracks` literal for the prepared copies. */
export function buildTrackEntryParts(tracks: readonly PreparedTrack[]): { imports: string; literal: string; hashes: string } {
  if (tracks.length === 0) return { imports: '', literal: '', hashes: '' };
  const imports = tracks.map((t) => `import ${t.ref.identifier} from './${t.ref.fileName}';`).join('\n');
  const entries = tracks.map((t) => `  ${JSON.stringify(t.assetId)}: { faces: ${t.ref.identifier} }`).join(',\n');
  return { imports, literal: `{\n${entries}\n}`, hashes: tracks.map((t) => `${t.assetId}:${t.sha256.slice(0, 16)}`).join(' ') };
}
