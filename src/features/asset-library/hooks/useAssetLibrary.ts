import { useCallback, useEffect, useState } from 'react';
import type { AssetEntry } from '../types';
import { classifyAsset } from '../services/file-type';

interface UseAssetLibraryResult {
  rootPath: string;
  currentPath: string;
  entries: AssetEntry[];
  loading: boolean;
  error: string | null;
  navigate: (path: string) => void;
  refresh: () => Promise<void>;
}

// Lists immediate children of `currentPath`. We deliberately do not pre-walk
// the whole tree — FILE_LIST is recursive but we only render one directory at
// a time and re-fetch on navigate, which keeps UI snappy on deep asset folders.
export function useAssetLibrary(): UseAssetLibraryResult {
  const [rootPath, setRootPath] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<AssetEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.fileList({ path, extensions: '*' });
      if (res.error) {
        setError(res.error);
        setEntries([]);
        return;
      }
      const next: AssetEntry[] = (res.nodes ?? []).map((node) => {
        if (node.type === 'folder') {
          return { node, category: 'other', ext: '' };
        }
        const { category, ext } = classifyAsset(node.name);
        return { node, category, ext };
      });
      setEntries(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read directory');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount: fetch the assets root, then list it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { path } = await window.api.fileGetAssetsDir();
        if (cancelled) return;
        setRootPath(path);
        setCurrentPath(path);
        await loadDir(path);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to resolve assets dir');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadDir]);

  const navigate = useCallback((path: string) => {
    setCurrentPath(path);
    void loadDir(path);
  }, [loadDir]);

  const refresh = useCallback(async () => {
    if (currentPath) await loadDir(currentPath);
  }, [currentPath, loadDir]);

  return { rootPath, currentPath, entries, loading, error, navigate, refresh };
}
