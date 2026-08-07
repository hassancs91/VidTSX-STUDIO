import { useCallback, useEffect, useState } from 'react';
import type { StudioProjectCreateRequest, StudioProjectSummary } from '@shared/ipc/types';

type Status = 'loading' | 'ready' | 'error';

interface State {
  status: Status;
  projects: StudioProjectSummary[];
  root: string;
  error: string | null;
}

export function useStudioProjects() {
  const [state, setState] = useState<State>({
    status: 'loading',
    projects: [],
    root: '',
    error: null,
  });

  const refresh = useCallback(async () => {
    const res = await window.api.studioProjectList();
    if (res.success && res.projects) {
      setState({ status: 'ready', projects: res.projects, root: res.root ?? '', error: null });
    } else {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: res.error ?? 'Failed to load projects',
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (req: StudioProjectCreateRequest): Promise<string | null> => {
      const res = await window.api.studioProjectCreate(req);
      if (!res.success || !res.project) {
        setState((prev) => ({ ...prev, error: res.error ?? 'Failed to create project' }));
        return null;
      }
      await refresh();
      return res.project.id;
    },
    [refresh],
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const res = await window.api.studioProjectDelete({ id });
    if (!res.success) {
      setState((prev) => ({ ...prev, error: res.error ?? 'Failed to delete project' }));
      return false;
    }
    setState((prev) => ({ ...prev, projects: prev.projects.filter((p) => p.id !== id) }));
    return true;
  }, []);

  const changeRoot = useCallback(async (): Promise<boolean> => {
    const picked = await window.api.dialogOpenFolder();
    if (picked.canceled || !picked.folderPath) return false;
    const res = await window.api.studioRootSet({ root: picked.folderPath });
    if (!res.success) {
      setState((prev) => ({ ...prev, error: res.error ?? 'Failed to set projects folder' }));
      return false;
    }
    await refresh();
    return true;
  }, [refresh]);

  return {
    status: state.status,
    projects: state.projects,
    root: state.root,
    error: state.error,
    refresh,
    create,
    remove,
    changeRoot,
  };
}
