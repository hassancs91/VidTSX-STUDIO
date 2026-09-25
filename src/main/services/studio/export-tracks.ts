// Export pre-flight for analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md
// "Analysis tracks"): the track of every asset a tracked filter is applied
// to rides beside the entry, so the render reads the SAME frames the Player
// painted from —
//
//   faces  the JSON copied verbatim and statically imported (`Track_<n>`);
//   masks  the index copied and imported (`MaskIndex_<n>`), the blobs
//          copied beside it as `.bin` and read by the render host from the
//          asset server by byte range (`createMaskReader` +
//          `httpRangeFetcher` — the bundle is served from that origin).
//
// A clip whose track is missing or still incomplete stops the export with a
// readable error — the editor refuses earlier (the chip), this is the
// backstop for every other way an export can start.

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { FACE_TRACK_REQUIREMENT, SUBJECT_MASK_REQUIREMENT } from '../../../shared/studio/filter-pack';
import { spansCovered, type TrackSpan } from '../../../shared/studio/analysis-track';
import { faceTrackRelPath, parseFaceTrack } from '../../../shared/studio/face-track';
import { maskBlobRelPath, maskIndexRelPath, parseMaskIndex } from '../../../shared/studio/mask-track';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import { maskEntryRefs, trackEntryRefs, type ShotEntryRef } from '../../../shared/studio/shot-export';
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

export interface PreparedMask extends PreparedTrack {
  /** The cache's blob file — copied beside the entry as `blobFileName`. */
  blobSource: string;
  blobFileName: string;
}

export interface PreparedAnalysisTracks {
  faces: PreparedTrack[];
  masks: PreparedMask[];
}

type Serialized = Pick<SerializedTimeline, 'tracks' | 'fps'>;

/** Asset id → the source spans its filtered clips play, from the serialized timeline. */
export function trackedSpans(serialized: Serialized, needsTrack: (kind: string) => boolean): Map<string, { spans: TrackSpan[]; clipIds: string[] }> {
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

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * The tracks the timeline's tracked filters read, per requirement. Throws
 * when a track is absent or does not cover a clip: the export must not start.
 */
export async function prepareAnalysisTracks(projectId: string, serialized: Serialized): Promise<PreparedAnalysisTracks> {
  const installed = new Map((await listFilters()).map((item) => [item.kind, item]));
  const requires = (requirement: string) => (kind: string) => installed.get(kind)?.requires.includes(requirement) ?? false;
  const faceNeeds = trackedSpans(serialized, requires(FACE_TRACK_REQUIREMENT));
  const maskNeeds = trackedSpans(serialized, requires(SUBJECT_MASK_REQUIREMENT));
  if (faceNeeds.size === 0 && maskNeeds.size === 0) return { faces: [], masks: [] };
  const cacheDir = await getProjectCacheDir(projectId);
  const cachePath = (relPath: string) => path.join(cacheDir, ...relPath.split('/'));

  const faceIds = [...faceNeeds.keys()].sort();
  const faceRefs = trackEntryRefs(faceIds, projectId);
  const faces: PreparedTrack[] = [];
  for (let i = 0; i < faceIds.length; i++) {
    const { spans, clipIds } = faceNeeds.get(faceIds[i])!;
    const json = await fs.readFile(cachePath(faceTrackRelPath(faceIds[i])), 'utf-8').catch(() => null);
    if (json === null) throw new Error(`Face analysis has not run for clip ${clipIds[0]} — apply the filter in the editor and wait for its chip to reach 100%, then export.`);
    const track = parseFaceTrack(JSON.parse(json) as unknown);
    if (!track) throw new Error(`The face track of clip ${clipIds[0]} is unreadable — remove and re-apply the filter to analyse it again.`);
    if (!track.static && !spansCovered(track.spans, spans, 1 / Math.max(1, track.fps))) {
      throw new Error(`Face analysis is still incomplete for clip ${clipIds[0]} — wait for its chip to reach 100%, then export.`);
    }
    faces.push({ assetId: faceIds[i], ref: faceRefs[i], json, sha256: sha256(json) });
  }

  const maskIds = [...maskNeeds.keys()].sort();
  const maskRefs = maskEntryRefs(maskIds, projectId);
  const masks: PreparedMask[] = [];
  for (let i = 0; i < maskIds.length; i++) {
    const { spans, clipIds } = maskNeeds.get(maskIds[i])!;
    const json = await fs.readFile(cachePath(maskIndexRelPath(maskIds[i])), 'utf-8').catch(() => null);
    if (json === null) throw new Error(`Subject analysis has not run for clip ${clipIds[0]} — apply the filter in the editor and wait for its chip to reach 100%, then export.`);
    const index = parseMaskIndex(JSON.parse(json) as unknown);
    const blobSource = cachePath(maskBlobRelPath(maskIds[i]));
    const blobSize = (await fs.stat(blobSource).catch(() => null))?.size ?? -1;
    if (!index || blobSize < index.bytes) throw new Error(`The subject mask of clip ${clipIds[0]} is unreadable — remove and re-apply the filter to analyse it again.`);
    if (!index.static && !spansCovered(index.spans, spans, 1 / Math.max(1, index.fps))) {
      throw new Error(`Subject analysis is still incomplete for clip ${clipIds[0]} — wait for its chip to reach 100%, then export.`);
    }
    masks.push({ assetId: maskIds[i], ref: maskRefs[i].index, json, sha256: sha256(json), blobSource, blobFileName: maskRefs[i].blobFileName });
  }
  return { faces, masks };
}

/** Write the prepared copies beside the entry: the JSON verbatim, the mask blobs copied. */
export async function writeAnalysisTracks(dir: string, prepared: PreparedAnalysisTracks): Promise<void> {
  for (const t of prepared.faces) await fs.writeFile(path.join(dir, t.ref.fileName), t.json, 'utf-8');
  for (const m of prepared.masks) {
    await fs.writeFile(path.join(dir, m.ref.fileName), m.json, 'utf-8');
    // A copy, not the cache file: an analysis that extends the track while
    // the export renders appends to the cache, never to this snapshot.
    await fs.copyFile(m.blobSource, path.join(dir, m.blobFileName));
  }
}

/**
 * The entry's parts: the import lines, the `@shared/studio` names they need,
 * the `tracks` literal and the hash line that makes the bundle cache follow
 * the tracks. `assetUrlBase` + `dir` locate the blob copies for the render host.
 */
export function buildTrackEntryParts(
  prepared: PreparedAnalysisTracks,
  assetUrlBase: string,
  dir: string,
): { imports: string; sharedImports: string[]; literal: string; hashes: string } {
  const all = [...prepared.faces, ...prepared.masks];
  if (all.length === 0) return { imports: '', sharedImports: [], literal: '', hashes: '' };
  const imports = all.map((t) => `import ${t.ref.identifier} from './${t.ref.fileName}';`).join('\n');
  const assetIds = [...new Set(all.map((t) => t.assetId))].sort();
  const entries = assetIds.map((assetId) => {
    const parts: string[] = [];
    const face = prepared.faces.find((t) => t.assetId === assetId);
    const mask = prepared.masks.find((t) => t.assetId === assetId);
    if (face) parts.push(`faces: ${face.ref.identifier}`);
    if (mask) {
      const url = `${assetUrlBase}/asset?path=${encodeURIComponent(path.join(dir, mask.blobFileName))}`;
      parts.push(`masks: createMaskReader(${mask.ref.identifier}, httpRangeFetcher(${JSON.stringify(url)}))`);
    }
    return `  ${JSON.stringify(assetId)}: { ${parts.join(', ')} }`;
  });
  const hashes = [
    ...prepared.faces.map((t) => `${t.assetId}:${t.sha256.slice(0, 16)}`),
    ...prepared.masks.map((t) => `${t.assetId}:mask:${t.sha256.slice(0, 16)}`),
  ].join(' ');
  return {
    imports,
    sharedImports: prepared.masks.length > 0 ? ['createMaskReader', 'httpRangeFetcher'] : [],
    literal: `{\n${entries.join(',\n')}\n}`,
    hashes,
  };
}
