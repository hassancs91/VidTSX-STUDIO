import { useCallback, useEffect, useState } from 'react';
import type { LibraryState } from '@shared/types/library';
import { scanLibrary } from '@shared/services/library-scanner';

export function useStudioLibrary() {
  const [library, setLibrary] = useState<LibraryState>({ folders: [], rootProjects: [] });

  const refresh = useCallback(async () => {
    const result = await scanLibrary();
    setLibrary(result);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = window.api.onThumbnailReady(() => {
      refresh();
    });
    return unsub;
  }, [refresh]);

  return { library, refresh };
}
