import { useEffect, useState } from 'react';
import type { StudioPresetOrientation, StudioPresetVideoKind } from '@shared/types/studio-preset';

export interface PresetOption {
  id: string;
  name: string;
  description?: string;
  videoKind: StudioPresetVideoKind;
  orientation?: StudioPresetOrientation;
}

/**
 * Read-only preset list for the per-project preset picker and the new-project
 * dialog (V1 completion plan §2.5). The studio feature never imports
 * asset-library — the shared library IPC surface is the one crossing point
 * (the useBrandList rule). Fetched once per mount; preset curation happens on
 * the Assets screen, so staleness within an editor session is acceptable.
 */
export function usePresetList(): PresetOption[] {
  const [presets, setPresets] = useState<PresetOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void window.api.libraryPresetsGet().then((res) => {
      if (!cancelled && res.success && res.presets) {
        setPresets(
          res.presets.map(({ id, name, description, videoKind, orientation }) => ({
            id,
            name,
            ...(description ? { description } : {}),
            videoKind,
            ...(orientation ? { orientation } : {}),
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return presets;
}
