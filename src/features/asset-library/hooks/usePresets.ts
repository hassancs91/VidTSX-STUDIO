import { useCallback, useEffect, useState } from 'react';
import type { StudioPresetEntry } from '@shared/types/studio-preset';
import type { StudioPresetInput } from '@shared/studio/preset';

/**
 * Preset list for the Assets screen (V1 completion plan §2.5), the useBrands
 * shape: mutations return an error string (null = ok) so the dialog can show
 * inline feedback; every successful mutation re-fetches.
 */
export function usePresets() {
  const [presets, setPresets] = useState<StudioPresetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await window.api.libraryPresetsGet();
      if (res.success) setPresets(res.presets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreset = useCallback(
    async (input: StudioPresetInput, presetId?: string): Promise<string | null> => {
      const res = await window.api.libraryPresetSave({ ...(presetId ? { presetId } : {}), input });
      if (!res.success) return res.error ?? 'Failed to save the preset';
      await refresh();
      return null;
    },
    [refresh],
  );

  const deletePreset = useCallback(
    async (presetId: string): Promise<string | null> => {
      const res = await window.api.libraryPresetDelete({ presetId });
      if (!res.success) return res.error ?? 'Failed to delete the preset';
      await refresh();
      return null;
    },
    [refresh],
  );

  return { presets, loading, refresh, savePreset, deletePreset };
}
