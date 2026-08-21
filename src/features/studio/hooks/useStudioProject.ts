import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioSnapshotRestoreResponse } from '@shared/ipc/types';
import type { StudioProject } from '../types';

type Status = 'loading' | 'ready' | 'error';

const SAVE_DEBOUNCE_MS = 600;

/** Loads one project document and owns its in-memory state. Every mutation
 *  goes through `updateProject`, which debounce-persists the whole document
 *  (single-writer model: the renderer owns project.json while it's open). */
export function useStudioProject(projectId: string) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'error'>('saved');

  const latestRef = useRef<StudioProject | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setProject(null);
    latestRef.current = null;
    dirtyRef.current = false;

    void window.api.studioProjectLoad({ id: projectId }).then((res) => {
      if (cancelled) return;
      if (res.success && res.project) {
        latestRef.current = res.project;
        setProject(res.project);
        setFolderPath(res.folderPath ?? null);
        setStatus('ready');
        setError(null);
      } else {
        setStatus('error');
        setError(res.error ?? 'Failed to load project');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const persist = useCallback(async () => {
    const doc = latestRef.current;
    if (!doc || !dirtyRef.current) return;
    dirtyRef.current = false;
    const res = await window.api.studioProjectSave({ project: doc });
    // A later edit may have re-dirtied the doc while this save was in flight.
    setSaveState(res.success ? (dirtyRef.current ? 'pending' : 'saved') : 'error');
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  /** Cancel the debounce and save now (no-op when nothing is dirty). */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await persist();
  }, [persist]);

  // Flush pending edits when the editor closes.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  // Q10 quit-flush hardening: React cleanup does not run on window close or
  // app quit, so the debounce alone could lose the last ~600 ms of edits.
  // beforeunload posts the save invoke synchronously before teardown, blur is
  // free insurance, and the main-process close guard defers the close until
  // this hook acks that the flush landed.
  useEffect(() => {
    const flushNow = () => void flush();
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('blur', flushNow);
    const unsubscribe = window.api.onStudioFlushRequest(() => {
      void flush().finally(() => void window.api.studioFlushAck());
    });
    return () => {
      window.removeEventListener('beforeunload', flushNow);
      window.removeEventListener('blur', flushNow);
      unsubscribe();
    };
  }, [flush]);

  // Q10 restore: flush first so a pending save can never overwrite the
  // restored file, then swap the in-memory document for what main wrote.
  // The caller resets the timeline reducer from the returned project.
  const restoreVersion = useCallback(
    async (file: string): Promise<StudioSnapshotRestoreResponse> => {
      await flush();
      const res = await window.api.studioProjectSnapshotRestore({ id: projectId, file });
      if (res.success && res.project) {
        latestRef.current = res.project;
        dirtyRef.current = false;
        setProject(res.project);
        setSaveState('saved');
      }
      return res;
    },
    [projectId, flush],
  );

  const updateProject = useCallback(
    (updater: (prev: StudioProject) => StudioProject) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        latestRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  const importMedia = useCallback(async (): Promise<{
    added: number;
    errors: string[];
    canceled: boolean;
  }> => {
    const res = await window.api.studioMediaImport({ projectId });
    if (!res.success) return { added: 0, errors: [res.error ?? 'Import failed'], canceled: false };
    if (res.canceled || !res.assets) return { added: 0, errors: [], canceled: true };
    const assets = res.assets;
    if (assets.length > 0) {
      updateProject((prev) => ({ ...prev, assets: [...prev.assets, ...assets] }));
    }
    return { added: assets.length, errors: res.errors ?? [], canceled: false };
  }, [projectId, updateProject]);

  const removeAsset = useCallback(
    (assetId: string) => {
      updateProject((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== assetId),
      }));
    },
    [updateProject],
  );

  return {
    project,
    folderPath,
    status,
    error,
    saveState,
    updateProject,
    importMedia,
    removeAsset,
    restoreVersion,
  };
}
