import type { LibraryIndexEntry, PlayableMediaKind } from '../../../../shared/types/asset-library';
import { isPlayableMediaKind, isTimedMediaKind, mediaKindOf } from '../../../../shared/media-kinds';
import { probeStateOf } from '../../library/library-probe-state';

/** Library listings are capped so a large root cannot flood the context. */
export const LIBRARY_LIST_CAP = 150;

export interface LibraryListingFilter {
  kind?: PlayableMediaKind;
  /** Lower-cased substring over the path and the description. */
  query?: string;
}

/**
 * One `list_assets(scope:'library')` row (E1): the ref, the kind from the
 * index (the one extension table) and, for audio/video, the ffprobe duration
 * to the hundredth (≤ 5 ms rounding) — or "length unknown (probing)" while the
 * back-fill has not reached the file (or a stale probe) yet, and "length unknown
 * (unreadable)" when ffprobe failed on this very version of the file.
 */
export function formatLibraryRow(entry: LibraryIndexEntry, kind: PlayableMediaKind, refPrefix: string): string {
  const state = probeStateOf({ ...entry, kind });
  const length = !isTimedMediaKind(kind)
    ? ''
    : entry.probe && state === 'ok'
      ? `, ${entry.probe.duration.toFixed(2)} s`
      : state === 'failed'
        ? ', length unknown (unreadable)'
        : ', length unknown (probing)';
  const brand = entry.brandId ? `, brand: ${entry.brandId}` : '';
  const description = entry.description ? ` — "${entry.description}"` : '';
  return `- ${refPrefix}${entry.relPath} (${kind}${length}, ${entry.origin}${brand})${description}`;
}

/** The library listing: playable kinds only (what insert_asset / assetRefs take), filtered, capped. */
export function formatLibraryListing(
  entries: LibraryIndexEntry[],
  filter: LibraryListingFilter,
  refPrefix: string,
): string {
  const rows: string[] = [];
  for (const entry of entries) {
    const kind = entry.kind ?? mediaKindOf(entry.relPath);
    if (!isPlayableMediaKind(kind) || (filter.kind && kind !== filter.kind)) continue;
    const q = filter.query;
    if (q && !entry.relPath.toLowerCase().includes(q) && !(entry.description ?? '').toLowerCase().includes(q)) continue;
    rows.push(formatLibraryRow(entry, kind, refPrefix));
    if (rows.length >= LIBRARY_LIST_CAP) {
      rows.push(`… capped at ${LIBRARY_LIST_CAP} — narrow with query/kind.`);
      break;
    }
  }
  return rows.length > 0 ? rows.join('\n') : 'No matching assets in the library.';
}
