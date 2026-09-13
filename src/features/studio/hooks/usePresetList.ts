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
 * (the useBrandList rule). Preset curation happens on the Assets screen, so
 * the list re-reads whenever the Studio screen becomes active again.
 */
export function usePresetList(): PresetOption[] {
  const [presets, setPresets] = useState<PresetOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await window.api.libraryPresetsGet();
      if (cancelled || !res.success || !res.presets) return;
      setPresets(
        res.presets.map(({ id, name, description, videoKind, orientation }) => ({
          id,
          name,
          ...(description ? { description } : {}),
          videoKind,
          ...(orientation ? { orientation } : {}),
        })),
      );
    };
    const onScreen = (e: Event) => {
      if ((e as CustomEvent<{ screen?: string }>).detail?.screen === 'studio') void load();
    };
    void load();
    window.addEventListener('vidtsx:screen-active', onScreen);
    return () => {
      cancelled = true;
      window.removeEventListener('vidtsx:screen-active', onScreen);
    };
  }, []);

  return presets;
}
