import type { LibrarySearchMode, LibrarySearchResult, LibrarySearchStatus } from './types/library-search';

/**
 * Plain-words labels for library search (LIBRARY_SEARCH_DESIGN.md §4 / §8.3), shared by the
 * Settings "Library search" row and the Assets box's "Smart" marker. Pure.
 */

export const SEARCH_MODE_LABELS: Record<LibrarySearchMode, string> = {
  basic: 'Basic',
  smart: 'Smart',
  'smart-rerank': 'Smart + AI rerank',
};

/** "135 MB" — decimal megabytes, the way the model catalog labels it. */
export function modelSizeLabel(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`;
}

/** "51 / 51 ready", "building 12 / 51", or "no vectors yet". */
export function vectorStateLabel(vectors: LibrarySearchStatus['vectors']): string {
  if (vectors.building) return `building ${vectors.ready} / ${vectors.total}`;
  if (vectors.total === 0) return 'no vectors yet';
  return `${vectors.ready} / ${vectors.total} ready`;
}

/** The mode that runs now, and why: "Smart (auto)", "Basic (auto — model not downloaded)", "Basic". */
export function effectiveModeLabel(status: LibrarySearchStatus): string {
  const mode = SEARCH_MODE_LABELS[status.mode];
  if (status.choice === 'auto') return status.modelDownloaded ? `${mode} (auto)` : `${mode} (auto — model not downloaded)`;
  if (status.choice !== status.mode && !status.modelDownloaded) {
    return `${mode} (${SEARCH_MODE_LABELS[status.choice]} needs the model — not downloaded)`;
  }
  return mode;
}

/** The Assets box marker's tooltip: the mode, the vector state, and a fallback for this search if one happened. */
export function searchMarkerTitle(status: LibrarySearchStatus, result: LibrarySearchResult | null): string {
  const method = status.mode === 'basic' ? 'words only' : 'words + meaning';
  const parts = [`Library search: ${effectiveModeLabel(status)} — ${method}`, `vectors ${vectorStateLabel(status.vectors)}`];
  if (result && result.ran === 'basic' && status.mode !== 'basic') {
    parts.push(`this search ran words only${result.degraded ? `: ${result.degraded}` : ''}`);
  }
  return parts.join(' · ');
}
