import { useCallback, useEffect, useState } from 'react';
import type { StudioPreset } from '@shared/ipc/types';
import {
  createEmptyPreset,
  deletePreset as deletePresetRemote,
  fetchPresets,
  savePreset as savePresetRemote,
} from '../services/presets-service';

interface UseStudioPresetsResult {
  presets: StudioPreset[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  createPreset: () => Promise<StudioPreset>;
  updatePreset: (id: string, patch: { name?: string; content?: string }) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStudioPresets(): UseStudioPresetsResult {
  const [presets, setPresets] = useState<StudioPreset[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const next = await fetchPresets();
      setPresets(next);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createPreset = useCallback(async (): Promise<StudioPreset> => {
    const draft = createEmptyPreset();
    await savePresetRemote(draft);
    setPresets((prev) => [draft, ...prev]);
    return draft;
  }, []);

  const updatePreset = useCallback(
    async (id: string, patch: { name?: string; content?: string }) => {
      const existing = presets.find((p) => p.id === id);
      if (!existing) return;
      const next: StudioPreset = {
        ...existing,
        name: patch.name ?? existing.name,
        content: patch.content ?? existing.content,
        updatedAt: Date.now(),
      };
      // Optimistic — list re-orders by updatedAt desc so the edited preset floats up.
      setPresets((prev) => {
        const without = prev.filter((p) => p.id !== id);
        return [next, ...without];
      });
      await savePresetRemote(next);
    },
    [presets]
  );

  const removePreset = useCallback(async (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    await deletePresetRemote(id);
  }, []);

  return { presets, status, error, createPreset, updatePreset, removePreset, refresh };
}
