import { searchMarkerTitle } from '@shared/library-search-text';
import type { LibrarySearchResult, LibrarySearchStatus } from '@shared/types/library-search';

/**
 * The small "Smart" marker by the Assets search box (LIBRARY_SEARCH_DESIGN.md §8.3): shown
 * while the effective mode is not Basic; its tooltip names the mode, the vector state and a
 * words-only fallback of the last search. A badge per UI_SPEC (9px, 1px 5px, 4px radius).
 */
export function SmartSearchMarker({ status, result }: { status: LibrarySearchStatus | null; result: LibrarySearchResult | null }) {
  if (!status || status.mode === 'basic') return null;
  return (
    <span
      data-library-search-marker={status.mode}
      title={searchMarkerTitle(status, result)}
      className="shrink-0 px-[5px] py-[1px] rounded text-[9px] bg-app-active text-accent-light cursor-default select-none"
      style={{ border: '0.5px solid var(--color-accent)' }}
    >
      Smart
    </span>
  );
}
