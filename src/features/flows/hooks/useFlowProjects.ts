import { useCallback, useEffect, useState } from 'react';
import type {
  FlowProjectSummary,
  FlowProjectCreateRequest,
} from '@shared/ipc/types';

type Status = 'loading' | 'ready' | 'error';

interface State {
  status: Status;
  projects: FlowProjectSummary[];
  error: string | null;
}

export function useFlowProjects() {
  const [state, setState] = useState<State>({
    status: 'loading',
    projects: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    const res = await window.api.flowsProjectList();
    if (res.success && res.projects) {
      setState({ status: 'ready', projects: res.projects, error: null });
    } else {
      setState({ status: 'error', projects: [], error: res.error ?? 'Failed to load flows' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (req: FlowProjectCreateRequest): Promise<FlowProjectSummary | null> => {
      const res = await window.api.flowsProjectCreate(req);
      if (!res.success || !res.project) {
        setState((prev) => ({ ...prev, error: res.error ?? 'Failed to create flow' }));
        return null;
      }
      await refresh();
      const { graphJson: _graphJson, ...summary } = res.project;
      return summary;
    },
    [refresh]
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const res = await window.api.flowsProjectDelete({ id });
    if (!res.success) {
      setState((prev) => ({ ...prev, error: res.error ?? 'Failed to delete flow' }));
      return false;
    }
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }));
    return true;
  }, []);

  return {
    status: state.status,
    projects: state.projects,
    error: state.error,
    refresh,
    create,
    remove,
  };
}
