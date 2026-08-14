import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryIndexEntry, LibrarySizes } from '@shared/types/asset-library';

interface UseLibraryIndexResult {
  /** Index entries keyed by POSIX rel path (assets-root relative). */
  metaByRelPath: Map<string, LibraryIndexEntry>;
  sizes: LibrarySizes | null;
  /** Re-scan the index + sizes; call after any action that changes disk. */
  refreshIndex: () => Promise<void>;
  /** Optimistic description save; returns false (and reverts) on failure. */
  saveDescription: (relPath: string, description: string) => Promise<boolean>;
}

/** POSIX rel path from the assets root — the index key. */
export function toLibraryRelPath(rootPath: string, absPath: string): string {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const root = norm(rootPath);
  const abs = norm(absPath);
  return abs.startsWith(root + '/') ? abs.slice(root.length + 1) : abs === root ? '' : abs;
}

/**
 * The library's index overlay (descriptions, origin, brand tags) + sizes,
 * mirrored into renderer state (ASSET_LIBRARY_DESIGN.md L1/L4). The scan
 * runs main-side on every fetch, so refreshing after imports/moves keeps
 * rel-path keys in step with disk.
 */
export function useLibraryIndex(): UseLibraryIndexResult {
  const [metaByRelPath, setMetaByRelPath] = useState<Map<string, LibraryIndexEntry>>(new Map());
  const [sizes, setSizes] = useState<LibrarySizes | null>(null);
  const fetchNonce = useRef(0);

  const refreshIndex = useCallback(async () => {
    const nonce = ++fetchNonce.current;
    try {
      const [indexRes, sizesRes] = await Promise.all([
        window.api.libraryIndexGet(),
        window.api.librarySizesGet(),
      ]);
      if (nonce !== fetchNonce.current) return; // superseded
      if (indexRes.success && indexRes.entries) {
        setMetaByRelPath(new Map(indexRes.entries.map((e) => [e.relPath, e])));
      }
      if (sizesRes.success && sizesRes.sizes) {
        setSizes(sizesRes.sizes);
      }
    } catch {
      // Listing still works without the overlay; leave last-known state.
    }
  }, []);

  useEffect(() => {
    void refreshIndex();
  }, [refreshIndex]);

  const saveDescription = useCallback(
    async (relPath: string, description: string): Promise<boolean> => {
      const previous = metaByRelPath.get(relPath);
      if (!previous) return false;
      const trimmed = description.trim();
      setMetaByRelPath((prev) => {
        const next = new Map(prev);
        next.set(relPath, { ...previous, description: trimmed === '' ? undefined : trimmed });
        return next;
      });
      try {
        const res = await window.api.libraryDescriptionSet({ relPath, description });
        if (!res.success) throw new Error(res.error ?? 'save failed');
        return true;
      } catch {
        setMetaByRelPath((prev) => {
          const next = new Map(prev);
          next.set(relPath, previous);
          return next;
        });
        return false;
      }
    },
    [metaByRelPath]
  );

  return { metaByRelPath, sizes, refreshIndex, saveDescription };
}
