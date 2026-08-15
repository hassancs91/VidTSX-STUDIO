// Import-a-TSX state for the pool's Shots section (TSX_SHOTS_DESIGN.md §D14).
//
// Deliberately thin: every source funnels into the SAME ipc call, which funnels
// into the same main-process accept path. Picking a Creator project supplies a
// file path and a name; the file picker supplies neither (main opens the OS
// dialog); "Convert for Studio" re-sends the source main echoed back, with
// conform: true. A ready shot arrives on the shot job stream like any other —
// nothing here touches the registry.

import { useCallback, useState } from 'react';
import type { StudioCreatorProject } from '@shared/ipc/types';

/** A failed import, with the source kept so Convert can retry it. */
export interface ShotImportFailure {
  message: string;
  /** Only the allowlist gap failed — one conform pass would fix it. */
  conformable: boolean;
  sourcePath?: string;
  name?: string;
}

interface Options {
  projectId: string;
  providerId?: string;
}

export function useShotImport({ projectId, providerId }: Options) {
  const [creatorProjects, setCreatorProjects] = useState<StudioCreatorProject[] | null>(null);
  const [listing, setListing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ShotImportFailure | null>(null);

  /** Scanned on demand — the picker asks each time it opens (folder-as-truth). */
  const loadCreatorProjects = useCallback(async () => {
    setListing(true);
    try {
      const res = await window.api.studioCreatorProjects();
      setCreatorProjects(res.success && res.projects ? res.projects : []);
      if (!res.success) {
        setFailure({ message: res.error ?? 'Could not list Creator projects', conformable: false });
      }
    } finally {
      setListing(false);
    }
  }, []);

  const runImport = useCallback(
    async (source: { sourcePath?: string; name?: string; conform?: boolean }) => {
      setBusy(true);
      setFailure(null);
      try {
        const res = await window.api.studioShotImport({
          projectId,
          ...(source.sourcePath ? { sourcePath: source.sourcePath } : {}),
          ...(source.name ? { name: source.name } : {}),
          ...(source.conform ? { conform: true } : {}),
          ...(providerId ? { providerId } : {}),
        });
        if (res.success || res.canceled) return res.success;
        setFailure({
          message: res.error ?? 'Import failed',
          conformable: res.conformable === true,
          ...(res.sourcePath ? { sourcePath: res.sourcePath } : {}),
          ...(res.name ? { name: res.name } : {}),
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [projectId, providerId],
  );

  const importFromCreator = useCallback(
    (project: StudioCreatorProject) => runImport({ sourcePath: project.filePath, name: project.name }),
    [runImport],
  );

  /** No path: main opens the OS picker (the renderer never sees file paths first). */
  const importFromFile = useCallback(() => runImport({}), [runImport]);

  const convertForStudio = useCallback(() => {
    if (!failure?.conformable || !failure.sourcePath) return Promise.resolve(false);
    return runImport({
      sourcePath: failure.sourcePath,
      ...(failure.name ? { name: failure.name } : {}),
      conform: true,
    });
  }, [failure, runImport]);

  return {
    creatorProjects,
    listing,
    busy,
    failure,
    clearFailure: useCallback(() => setFailure(null), []),
    loadCreatorProjects,
    importFromCreator,
    importFromFile,
    convertForStudio,
  };
}
