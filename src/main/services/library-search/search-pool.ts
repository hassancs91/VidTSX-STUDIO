// Which library entries may answer a search (LIBRARY_SEARCH_DESIGN.md §3): `kinds`, the sound class, the minimum
// length and the `scope` folder. The sound-class + length rule is E3's `isCandidate` (`library/sound-match.ts`),
// restated here through the exported `soundClassOf` — the matcher files stay byte-identical to 7967c6f, and
// `search-pool.test.ts` pins that this pool equals the matcher's own candidate set on the 51-clip corpus. Pure.

import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { LibrarySearchRequest } from '../../../shared/types/library-search';
import { isPlayableMediaKind, mediaKindOf } from '../../../shared/media-kinds';
import { soundClassOf } from '../library/sound-match';

function inScope(relPath: string, scope: string | undefined): boolean {
  const folder = (scope ?? '').replace(/\/+$/, '');
  return folder === '' || relPath === folder || relPath.startsWith(`${folder}/`);
}

function fitsSound(entry: LibraryIndexEntry, request: LibrarySearchRequest): boolean {
  if (request.soundClass) {
    const cls = soundClassOf(entry);
    if (cls !== 'either' && cls !== request.soundClass) return false;
  }
  const duration = entry.probe?.duration;
  return request.minDurationSec === undefined || typeof duration !== 'number' || duration >= request.minDurationSec;
}

/** LS-r4: search covers the playable media kinds only — `data`, fonts, 3D models and other files are neither embedded nor returned. */
export function searchPool(entries: LibraryIndexEntry[], request: LibrarySearchRequest): LibraryIndexEntry[] {
  const kinds = request.kinds && request.kinds.length > 0 ? new Set<string>(request.kinds) : undefined;
  return entries.filter((entry) => {
    if (!inScope(entry.relPath, request.scope)) return false;
    const kind = entry.kind ?? mediaKindOf(entry.relPath);
    if (!isPlayableMediaKind(kind) || (kinds && !kinds.has(kind))) return false;
    return kind !== 'audio' || fitsSound(entry, request);
  });
}
