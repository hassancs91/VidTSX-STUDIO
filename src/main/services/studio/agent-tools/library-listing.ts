import type { LibraryIndexEntry, PlayableMediaKind } from '../../../../shared/types/asset-library';
import { isPlayableMediaKind, isTimedMediaKind, mediaKindOf } from '../../../../shared/media-kinds';
import { probeStateOf } from '../../library/library-probe-state';
import { signed } from '../../library/format-level';

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
  return `- ${refPrefix}${entry.relPath} (${kind}${length}, ${entry.origin}${brand})${description}${formatMetaSuffix(entry)}`;
}

/**
 * The E2 suffix after the description — `· category: motion · tags: whoosh, air
 * · −20.0 LUFS · used in: p1, p2` — each clause only when the entry carries it,
 * so an entry without the T6 fields prints exactly as in E1. A file the
 * normalize step could not level says so: ` · −12.3 LUFS (not normalized)` with
 * its measured value, ` · not normalized` without one.
 */
function formatMetaSuffix(entry: LibraryIndexEntry): string {
  const clauses: string[] = [];
  const audio = entry.audio;
  if (audio?.category) clauses.push(`category: ${audio.category}`);
  if (entry.tags && entry.tags.length > 0) clauses.push(`tags: ${entry.tags.join(', ')}`);
  const lufs = audio?.loudnessLufs;
  const notNormalized = Boolean(audio?.normalizeError);
  if (typeof lufs === 'number' && Number.isFinite(lufs)) {
    clauses.push(`${signed(lufs)} LUFS${notNormalized ? ' (not normalized)' : ''}`);
  } else if (notNormalized) {
    clauses.push('not normalized');
  }
  if (entry.usedIn && entry.usedIn.length > 0) clauses.push(`used in: ${entry.usedIn.join(', ')}`);
  return clauses.map((clause) => ` · ${clause}`).join('');
}

/**
 * The query filter (E3): EVERY whitespace-separated word of the query must
 * appear (case-insensitive substring) in the path, the description, a tag or
 * the category. A one-word query works as before, now also over tags and
 * category; "soft whoosh" finds `sfx/whoosh-soft.mp3`, which the old
 * whole-phrase substring missed.
 */
function matchesQuery(entry: LibraryIndexEntry, query: string | undefined): boolean {
  const words = (query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [entry.relPath, entry.description ?? '', ...(entry.tags ?? []), entry.audio?.category ?? '']
    .join('\n')
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
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
    if (!matchesQuery(entry, filter.query)) continue;
    rows.push(formatLibraryRow(entry, kind, refPrefix));
    if (rows.length >= LIBRARY_LIST_CAP) {
      rows.push(`… capped at ${LIBRARY_LIST_CAP} — narrow with query/kind.`);
      break;
    }
  }
  return rows.length > 0 ? rows.join('\n') : 'No matching assets in the library.';
}
