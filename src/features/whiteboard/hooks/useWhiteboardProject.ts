import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhiteboardProjectData } from '@shared/ipc/types';
import type { Scene } from '@shared/types/whiteboard';
import {
  emptyScene,
  generateProjectId,
  generateProjectName,
  fetchProjectList,
  saveProject,
  loadProject,
  deleteProject,
} from '../services/whiteboard-service';
import { generateSceneThumbnail } from '../services/scene-thumbnail';

export type WhiteboardStatus = 'list' | 'loading' | 'ready' | 'error';

interface State {
  status: WhiteboardStatus;
  projects: WhiteboardProjectData[];
  currentProject: WhiteboardProjectData | null;
  error: string | null;
}

const SAVE_DEBOUNCE_MS = 500;

export function useWhiteboardProject() {
  const [state, setState] = useState<State>({
    status: 'list',
    projects: [],
    currentProject: null,
    error: null,
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingSaveRef = useRef<WhiteboardProjectData | null>(null);
  const lastThumbnailedSceneRef = useRef<Scene | null>(null);

  const refreshList = useCallback(async () => {
    const projects = await fetchProjectList();
    setState((prev) => ({ ...prev, projects }));
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const persist = useCallback(async (project: WhiteboardProjectData) => {
    let toSave = project;
    if (project.scene !== lastThumbnailedSceneRef.current) {
      try {
        const thumbnail = await generateSceneThumbnail(project.scene);
        if (thumbnail) {
          toSave = { ...project, thumbnail };
        }
        lastThumbnailedSceneRef.current = project.scene;
      } catch {
        // Thumbnail is best-effort; save the project regardless.
      }
    }
    await saveProject(toSave);
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    const pending = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (pending) {
      await persist(pending);
    }
  }, [persist]);

  const scheduleSave = useCallback((project: WhiteboardProjectData) => {
    pendingSaveRef.current = project;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveTimeoutRef.current = undefined;
      if (toSave) {
        persist(toSave).catch(() => {
          // Silent — next change will retry.
        });
      }
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  const createProject = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const id = generateProjectId();
      const now = Date.now();
      const project: WhiteboardProjectData = {
        id,
        name: generateProjectName(),
        scene: emptyScene(),
        createdAt: now,
        updatedAt: now,
      };

      await saveProject(project);

      setState((prev) => ({
        ...prev,
        status: 'ready',
        currentProject: project,
        projects: [project, ...prev.projects],
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  const openProject = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const project = await loadProject(id);
      setState((prev) => ({
        ...prev,
        status: 'ready',
        currentProject: project,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  const removeProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
      }));
    } catch {
      // Silent — project may already be gone.
    }
  }, []);

  const closeProject = useCallback(async () => {
    await flushPendingSave();
    await refreshList();
    setState((prev) => ({
      ...prev,
      status: 'list',
      currentProject: null,
      error: null,
    }));
  }, [flushPendingSave, refreshList]);

  const updateScene = useCallback(
    (scene: Scene) => {
      setState((prev) => {
        if (!prev.currentProject) return prev;
        const updated: WhiteboardProjectData = {
          ...prev.currentProject,
          scene,
          updatedAt: Date.now(),
        };
        scheduleSave(updated);
        return { ...prev, currentProject: updated };
      });
    },
    [scheduleSave]
  );

  const renameProject = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setState((prev) => {
        if (!prev.currentProject) return prev;
        const updated: WhiteboardProjectData = {
          ...prev.currentProject,
          name: trimmed,
          updatedAt: Date.now(),
        };
        scheduleSave(updated);
        return { ...prev, currentProject: updated };
      });
    },
    [scheduleSave]
  );

  return {
    status: state.status,
    projects: state.projects,
    currentProject: state.currentProject,
    error: state.error,
    refreshList,
    createProject,
    openProject,
    removeProject,
    closeProject,
    updateScene,
    renameProject,
  };
}
