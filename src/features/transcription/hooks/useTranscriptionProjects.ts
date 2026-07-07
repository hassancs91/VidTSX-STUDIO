import { useState, useEffect, useCallback } from 'react';
import type { TranscriptionProjectListEntry } from '../types';

export function useTranscriptionProjects() {
  const [projects, setProjects] = useState<TranscriptionProjectListEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await window.api.transcriptionProjectList();
      if (response.success && response.projects) {
        setProjects(response.projects);
      }
    } catch {
      // List is best-effort
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      const response = await window.api.transcriptionProjectDelete({ id });
      if (response.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
      return response.success;
    } catch {
      return false;
    }
  }, []);

  return { projects, loading, refresh, deleteProject };
}
