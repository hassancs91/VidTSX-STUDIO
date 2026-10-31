import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioSnapshotRestoreResponse } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProject } from '../types';
import { markOpen, resetOpenMarks } from '../services/open-timing';
import { createAutosave, type Autosave, type AutosaveState } from '../services/autosave';

type Status = 'loading' | 'ready' | 'error';

const SAVE_DEBOUNCE_MS = 600;

/** Give an unsaved document to main's project writer (B5 fix round 1): main
 *  owns the write from here — it retries for minutes, independent of this
 *  editor, and leaves project.json.tmp for recovery on the next open. */
async function handOffToMain(project: StudioProject): Promise<void> {
  try {
    const res = await window.api.studioProjectHandoff({ project });
    if (!res.success) console.error('[studio] Main refused the unsaved project:', res.error);
  } catch (err) {
    console.error('[studio] Could not hand the unsaved project to main:', err);
  }
}

/** Loads one project document and owns its in-memory state. Every mutation
 *  goes through `updateProject`, which debounce-persists the whole document
 *  (single-writer model: the renderer owns project.json while it's open). */
export function useStudioProject(projectId: string) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<AutosaveState>('saved');
  /** The last refusal's message while `saveState` is 'error' (B5 Problem 5). */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** The open recovered changes that never reached project.json — say so once. */
  const [recovered, setRecovered] = useState(false);

  // One autosave per opened project. A failed save stays dirty and retries
  // (services/autosave.ts) — memory and project.json never silently diverge.
  const autosaveRef = useRef<Autosave<StudioProject> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const autosave = createAutosave<StudioProject>({
      save: (doc) => window.api.studioProjectSave({ project: doc }),
      onState: (state, err) => {
        setSaveState(state);
        setSaveError(state === 'error' ? (err ?? 'Save failed') : null);
      },
      debounceMs: SAVE_DEBOUNCE_MS,
    });
    autosaveRef.current = autosave;
    setStatus('loading');
    setProject(null);
    setRecovered(false);
    resetOpenMarks();
    markOpen('load:start');

    void (async () => {
      const res = await window.api.studioProjectLoad({ id: projectId });
      if (cancelled) return;
      markOpen('load:end');
      if (res.success && res.project) {
        autosave.reset(res.project);
        // A recovered document is not on disk yet: save it like an edit.
        if (res.unsaved) autosave.update(res.project);
        setRecovered(res.recovered === true);
        setProject(res.project);
        setFolderPath(res.folderPath ?? null);
        setStatus('ready');
        setError(null);
      } else {
        setStatus('error');
        setError(res.error ?? 'Failed to load project');
      }
    })();

    // Editor closing: hand anything not yet on disk to main in one call —
    // main owns that write from now on (a save refused by a held project.json
    // is retried there for minutes; B5 fix round 1). Then tell main the
    // project is closed so its poster is written now (W6) — a close with
    // nothing dirty would otherwise leave the save-debounced poster waiting
    // on a save that never comes.
    return () => {
      cancelled = true;
      const unsaved = autosave.takeUnsaved();
      autosave.dispose();
      if (autosaveRef.current === autosave) autosaveRef.current = null;
      void (async () => {
        try {
          if (unsaved) await handOffToMain(unsaved);
        } finally {
          await window.api.studioProjectClose({ id: projectId });
          window.dispatchEvent(new CustomEvent('vidtsx:studio-projects-changed'));
        }
      })();
    };
  }, [projectId]);

  /** Cancel the debounce and save now (no-op when nothing is dirty). */
  const flush = useCallback(async () => {
    await autosaveRef.current?.flush();
  }, []);

  // Q10 quit-flush hardening: React cleanup does not run on window close or
  // app quit, so the debounce alone could lose the last ~600 ms of edits.
  // beforeunload posts the save invoke synchronously before teardown, blur is
  // free insurance, and the main-process close guard defers the close until
  // this hook acks. The ack follows a HAND-OFF, not a save: a save refused
  // by a held project.json would outlast the guard's 1.5 s, so main takes
  // the document and its shutdown waits for it (B5 fix round 1).
  useEffect(() => {
    const flushNow = () => void flush();
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('blur', flushNow);
    const unsubscribe = window.api.onStudioFlushRequest(() => {
      void (async () => {
        try {
          const unsaved = autosaveRef.current?.takeUnsaved() ?? null;
          if (unsaved) await handOffToMain(unsaved);
        } finally {
          await window.api.studioFlushAck();
        }
      })();
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
        autosaveRef.current?.reset(res.project);
        setProject(res.project);
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
        // An updater that changed nothing (a re-announced cache file, an
        // already-merged import) must not dirty the document into a save.
        if (next === prev) return prev;
        autosaveRef.current?.update(next);
        return next;
      });
    },
    [],
  );

  const importMedia = useCallback(async (): Promise<{
    added: number;
    errors: string[];
    canceled: boolean;
    /** The assets this import added (the A4 4K card reads their probes). */
    assets: StudioMediaAsset[];
  }> => {
    const res = await window.api.studioMediaImport({ projectId });
    if (!res.success) return { added: 0, errors: [res.error ?? 'Import failed'], canceled: false, assets: [] };
    if (res.canceled || !res.assets) return { added: 0, errors: [], canceled: true, assets: [] };
    const assets = res.assets;
    if (assets.length > 0) {
      updateProject((prev) => ({ ...prev, assets: [...prev.assets, ...assets] }));
    }
    return { added: assets.length, errors: res.errors ?? [], canceled: false, assets };
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
    saveError,
    recovered,
    updateProject,
    importMedia,
    removeAsset,
    restoreVersion,
  };
}
