import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  StudioProjectCaptions,
  TsxSuggestion,
  TsxSlot,
  StudioImport,
  StudioVideoClip,
  StudioAudioClip,
  StudioImageClip,
  StudioTextClip,
  StudioComposition,
  StudioAnalysisJson,
  StudioCutPlan,
  StudioTimelinePrefs,
  StudioPanelLayout,
} from '@shared/ipc/types';
import type { StudioProject, StudioStatus, StudioProjectData } from '../types';
import {
  getVideoUrl,
  createEmptyProjectData,
  fetchProjectList,
  saveProject,
  loadProject,
  deleteProject,
} from '../services/studio-service';

interface StudioState {
  status: StudioStatus;
  projects: StudioProjectData[];
  currentProject: StudioProject | null;
  currentProjectData: StudioProjectData | null;
  error: string | null;
}

export function useStudioState() {
  const [state, setState] = useState<StudioState>({
    status: 'list',
    projects: [],
    currentProject: null,
    currentProjectData: null,
    error: null,
  });

  // Load project list on mount
  const refreshList = useCallback(async () => {
    const projects = await fetchProjectList();
    setState((prev) => ({ ...prev, projects }));
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Create new empty project: no file picker, default composition.
  const createProject = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const projectData = createEmptyProjectData();
      await saveProject(projectData);

      setState((prev) => ({
        ...prev,
        status: 'ready',
        currentProject: {
          composition: projectData.composition,
        },
        currentProjectData: projectData,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  // Open existing project
  const openProject = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));

    try {
      const projectData = await loadProject(id);

      const project: StudioProject = { composition: projectData.composition };
      if (projectData.videoPath && projectData.metadata) {
        const videoUrl = await getVideoUrl(projectData.videoPath);
        project.video = {
          filePath: projectData.videoPath,
          fileName: projectData.metadata.fileName,
          videoUrl,
          metadata: projectData.metadata,
        };
      }

      setState((prev) => ({
        ...prev,
        status: 'ready',
        currentProject: project,
        currentProjectData: projectData,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open project';
      setState((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  // Delete project
  const removeProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
      }));
    } catch {
      // Silently fail — project may already be deleted
    }
  }, []);

  // Update project captions (debounced save)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const updateProjectCaptions = useCallback(
    (captions: StudioProjectCaptions | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          captions,
          updatedAt: Date.now(),
        };

        // Debounced save to disk
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project TSX suggestions (debounced save)
  const updateProjectTsxSuggestions = useCallback(
    (tsxSuggestions: TsxSuggestion[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          tsxSuggestions,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project TSX slots (debounced save)
  const updateProjectTsxSlots = useCallback(
    (tsxSlots: TsxSlot[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          tsxSlots,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project video clips (debounced save)
  const updateProjectVideoClips = useCallback(
    (videoClips: StudioVideoClip[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          videoClips,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project audio clips (SFX + Music, debounced save)
  const updateProjectAudioClips = useCallback(
    (audioClips: StudioAudioClip[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          audioClips,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project image clips (debounced save)
  const updateProjectImageClips = useCallback(
    (imageClips: StudioImageClip[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          imageClips,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project text clips (debounced save)
  const updateProjectTextClips = useCallback(
    (textClips: StudioTextClip[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          textClips,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project composition (canvas). Also reflected onto the renderer-side project.
  const updateProjectComposition = useCallback(
    (composition: StudioComposition) => {
      setState((prev) => {
        if (!prev.currentProjectData || !prev.currentProject) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          composition,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return {
          ...prev,
          currentProjectData: updated,
          currentProject: { ...prev.currentProject, composition },
        };
      });
    },
    []
  );

  // Update project imports (debounced save)
  const updateProjectImports = useCallback(
    (imports: StudioImport[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          imports,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update project brand markdown (debounced save)
  const updateProjectBrand = useCallback(
    (brand: string | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          brand,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Project → brand library binding. The brand id points to a row in
  // studio-brands.db; analysis + generation resolve its content at run time.
  const updateProjectBrandId = useCallback(
    (brandId: string | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          brandId,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Project → preset library binding. Presets stack — multiple ids may apply.
  const updateProjectPresetIds = useCallback(
    (presetIds: string[] | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const normalized = presetIds && presetIds.length > 0 ? presetIds : undefined;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          presetIds: normalized,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update cached analysis (debounced save). Only written when auto-cut completes
  // or when bake clears it.
  const updateProjectAnalysis = useCallback(
    (analysis: StudioAnalysisJson | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          analysis,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update cut plan (debounced save). Written on plan generation, review toggle, and bake clear.
  const updateProjectCutPlan = useCallback(
    (cutPlan: StudioCutPlan | undefined) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          cutPlan,
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update per-project timeline view preferences (hide names / hide waveform).
  // Merges a partial into the existing prefs so toggles are independent.
  const updateProjectTimelinePrefs = useCallback(
    (prefs: Partial<StudioTimelinePrefs>) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          timelinePrefs: { ...prev.currentProjectData.timelinePrefs, ...prefs },
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Update per-project panel layout (left / right / timeline sizes). Merges a
  // partial into the existing layout so each panel persists independently.
  const updateProjectLayout = useCallback(
    (layout: Partial<StudioPanelLayout>) => {
      setState((prev) => {
        if (!prev.currentProjectData) return prev;

        const updated: StudioProjectData = {
          ...prev.currentProjectData,
          layout: { ...prev.currentProjectData.layout, ...layout },
          updatedAt: Date.now(),
        };

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveProject(updated);
        }, 500);

        return { ...prev, currentProjectData: updated };
      });
    },
    []
  );

  // Close project → back to list
  const closeProject = useCallback(async () => {
    // Flush any pending debounced save immediately
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    // Save current project data before closing
    const currentData = state.currentProjectData;
    if (currentData) {
      await saveProject(currentData);
    }

    await refreshList();
    setState((prev) => ({
      ...prev,
      status: 'list',
      currentProject: null,
      currentProjectData: null,
      error: null,
    }));
  }, [refreshList, state.currentProjectData]);

  return {
    status: state.status,
    projects: state.projects,
    project: state.currentProject,
    projectData: state.currentProjectData,
    error: state.error,
    createProject,
    openProject,
    removeProject,
    closeProject,
    updateProjectCaptions,
    updateProjectTsxSuggestions,
    updateProjectTsxSlots,
    updateProjectImports,
    updateProjectVideoClips,
    updateProjectAudioClips,
    updateProjectImageClips,
    updateProjectTextClips,
    updateProjectComposition,
    updateProjectBrand,
    updateProjectBrandId,
    updateProjectPresetIds,
    updateProjectAnalysis,
    updateProjectCutPlan,
    updateProjectTimelinePrefs,
    updateProjectLayout,
  };
}
