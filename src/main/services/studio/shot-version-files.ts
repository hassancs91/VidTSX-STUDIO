// A TSX builder shot's own files at export (TSX_BUILDER_DESIGN.md P3 part 6, D8).
//
// A builder version loads files from its shot folder (`vN.assets/`, or an
// earlier `vK.assets/`): a 3D model, an environment map, a font, and the
// images / video / audio that part 5 also registers as project media. The
// export engines render the generated entry with no shot props of their own,
// so the files must ride in its TIMELINE: every tsx clip of such a shot gets
// the version's files under the props the serializer made from its
// `assetRefs` (which win for the same key), as URLs on the bundle server's
// asset roots. The folders travel in the entry's sidecar and are registered
// again before any engine renders (run-export.ts), so an export queued before
// a restart still finds them.
//
// Pre-flight: a builder shot whose code names a file that no `vK.assets/`
// holds and no assetRef maps fails the export with the file's name, before
// anything renders. Shot folders with no `vK.assets/` (every shot made before
// the builder) are left exactly as they were.

import fs from 'fs/promises';
import path from 'path';
import type { SerializedTimeline } from '../../../shared/studio/serialize';
import type { StudioShot } from '../../../shared/types/studio';
import { mergeVersionAssets } from '../../../shared/studio/shot-version-assets';
import { assetRootUrl, registerAssetRoot } from '../asset-roots';
import { versionAssetFiles } from '../tsx-builder/version-assets';

export interface UsedShotVersion {
  shot: Pick<StudioShot, 'id' | 'name' | 'activeVersion' | 'assetRefs'>;
  /** The ORIGINAL `shots/<id>/vN.tsx`, not the entry's copy: the lookup walks its folder. */
  versionPath: string;
}

export interface ShotVersionFiles {
  /** The timeline with the files merged in; the very same object when no shot has any. */
  timeline: SerializedTimeline;
  /** Every folder those URLs point into, for `StudioExportEntry.assetRoots`. */
  assetRoots: string[];
}

async function hasVersionAssets(folder: string): Promise<boolean> {
  const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
  return entries.some((e) => e.isDirectory() && /^v\d+\.assets$/i.test(e.name));
}

function missingMessage(shot: UsedShotVersion['shot'], missing: string[]): string {
  const files = missing.join(', ');
  const verb = missing.length === 1 ? 'is' : 'are';
  return `Shot "${shot.name}" (v${shot.activeVersion}): ${files} ${verb} missing from the shot folder (shots/${shot.id}/v${shot.activeVersion}.assets/). Put ${missing.length === 1 ? 'it' : 'them'} back, or switch the shot to a version that has ${missing.length === 1 ? 'it' : 'them'}.`;
}

/**
 * The used shots' own files merged into `timeline` as URLs on `origin` (the
 * bundle server), and the folders they come from. Throws the pre-flight error
 * for a builder shot that names a file nothing provides.
 */
export async function shotVersionFiles(
  timeline: SerializedTimeline,
  shots: readonly UsedShotVersion[],
  origin: string,
): Promise<ShotVersionFiles> {
  const filesByShot = new Map<string, Record<string, string>>();
  const roots = new Set<string>();
  for (const { shot, versionPath } of shots) {
    if (!(await hasVersionAssets(path.dirname(versionPath)))) continue;
    const files = await versionAssetFiles(versionPath);
    const refs = shot.assetRefs ?? {};
    const missing = files.filter((f) => f.dir === null && !refs[f.key]).map((f) => f.relPath);
    if (missing.length > 0) throw new Error(missingMessage(shot, missing));
    const urls: Record<string, string> = {};
    for (const f of files) {
      if (!f.dir) continue;
      urls[f.key] = assetRootUrl(origin, f.dir, f.relPath);
      roots.add(path.resolve(f.dir));
    }
    if (Object.keys(urls).length > 0) filesByShot.set(shot.id, urls);
  }
  if (filesByShot.size === 0) return { timeline, assetRoots: [] };
  return {
    timeline: {
      ...timeline,
      tracks: timeline.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          const files = clip.tsx ? filesByShot.get(clip.tsx.shotId) : undefined;
          if (!clip.tsx || !files) return clip;
          const props = mergeVersionAssets(clip.tsx.props, files);
          return { ...clip, tsx: { ...clip.tsx, ...(props ? { props } : {}) } };
        }),
      })),
    },
    assetRoots: [...roots],
  };
}

/** Before an export renders: serve the entry's shot folders again (a queued export may start after a restart). */
export function registerShotAssetRoots(roots: readonly string[] | undefined): void {
  for (const dir of roots ?? []) registerAssetRoot(dir);
}
