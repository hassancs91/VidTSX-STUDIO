import { useState, useEffect } from 'react';
import type { ContentPresetSetting, StylePresetSetting } from '../../../shared/ipc/types';
import { CONTENT_PRESETS, STYLE_PRESETS } from '../services/style-presets';

export function usePromptPresets() {
  const [contentPresets, setContentPresets] = useState<ContentPresetSetting[]>(CONTENT_PRESETS);
  const [stylePresets, setStylePresets] = useState<StylePresetSetting[]>(STYLE_PRESETS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await window.api.promptPresetsGet();
        setContentPresets(result.contentPresets);
        setStylePresets(result.stylePresets);
      } catch {
        // Silently fall back to defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { contentPresets, stylePresets, loading };
}
