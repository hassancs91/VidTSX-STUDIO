import { logEngine } from '../../../logging/log-engine';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { updateIndex } from './library-index-io';
import { getLibraryRoot, libraryRelPathOf } from './library-paths';

const log = logEngine.createLogger('LibraryUsedIn');

/**
 * `usedIn` — the ids of the projects a `library:` ref of a file landed in
 * (END_TO_END_PLAN T6, E2). Written on the three landings: `importLibraryFile`
 * (insert_asset, generate_sfx / generate_music, every W3 tool taking a library
 * ref), `resolveShotAssetRefs` (generate_tsx_shot assetRefs) and the pool import
 * of a file that already lies under the library root.
 *
 * It is an index patch on the per-root serialize chain (E-d5: `version: 1`,
 * `rev: 2`) — never a project.json write (main never writes it), never a new
 * entry (a file the index has not seen yet is left to the next scan), and never
 * a throw into the import path: a failed mark is logged, the import stands.
 */

/** Pure: add `projectId` to `entry.usedIn` once. True when the entry changed. */
export function addUsedIn(entry: LibraryIndexEntry, projectId: string): boolean {
  if (entry.usedIn?.includes(projectId)) return false;
  entry.usedIn = [...(entry.usedIn ?? []), projectId];
  return true;
}

/**
 * Mark `projectId` on the EXISTING entries for `relPaths` (POSIX index keys).
 * Deduplicated; nothing is written when nothing changed; resolves on failure.
 */
export async function markLibraryUsedIn(
  root: string,
  relPaths: readonly string[],
  projectId: string,
): Promise<void> {
  const wanted = [...new Set(relPaths.filter((p) => p.length > 0))];
  if (wanted.length === 0 || projectId.length === 0) return;
  try {
    await updateIndex(root, (index) => {
      const byRelPath = new Map(index.entries.map((e) => [e.relPath, e] as const));
      const unknown: string[] = [];
      let changed = false;
      for (const relPath of wanted) {
        const entry = byRelPath.get(relPath);
        if (!entry) {
          unknown.push(relPath);
          continue;
        }
        if (addUsedIn(entry, projectId)) changed = true;
      }
      if (unknown.length > 0) {
        log.warn('usedIn: not in the library index yet — left to the next scan', {
          root,
          projectId,
          relPaths: unknown,
        });
      }
      return changed;
    });
  } catch (err) {
    log.warn('usedIn: index patch failed — the import stands', {
      root,
      projectId,
      relPaths: wanted,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * The pool-import seam: absolute paths as imported; only those that lie UNDER
 * the library root are library landings (the rest are ordinary pool files).
 */
export async function markLibraryUsedInForPaths(
  projectId: string,
  absPaths: readonly string[],
): Promise<void> {
  if (projectId.length === 0 || absPaths.length === 0) return;
  try {
    const root = getLibraryRoot();
    const relPaths = absPaths
      .map((p) => libraryRelPathOf(root, p))
      .filter((p): p is string => p !== null);
    if (relPaths.length === 0) return;
    await markLibraryUsedIn(root, relPaths, projectId);
  } catch (err) {
    log.warn('usedIn: could not resolve the library root — skipped', {
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
