import { useState, useEffect, useCallback } from 'react';
import type { ContentPresetSetting, StylePresetSetting } from '../../shared/ipc/types';

export function usePromptPresets() {
  const [contentPresets, setContentPresets] = useState<ContentPresetSetting[]>([]);
  const [stylePresets, setStylePresets] = useState<StylePresetSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await window.api.promptPresetsGet();
      setContentPresets(result.contentPresets);
      setStylePresets(result.stylePresets);
    } catch {
      // Silently fail — defaults will be shown if empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateContentPreset = useCallback((id: string, updates: Partial<ContentPresetSetting>) => {
    setContentPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setSaveError(null);
  }, []);

  const addContentPreset = useCallback(() => {
    const newPreset: ContentPresetSetting = {
      id: `custom-${Date.now()}`,
      label: 'New Preset',
      aspectRatio: '1:1',
      promptSuffix: '',
    };
    setContentPresets((prev) => [...prev, newPreset]);
  }, []);

  const removeContentPreset = useCallback((id: string) => {
    setContentPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateStylePreset = useCallback((id: string, updates: Partial<StylePresetSetting>) => {
    setStylePresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
    setSaveError(null);
  }, []);

  const addStylePreset = useCallback(() => {
    const newPreset: StylePresetSetting = {
      id: `custom-${Date.now()}`,
      label: 'New Preset',
      promptSuffix: '',
    };
    setStylePresets((prev) => [...prev, newPreset]);
  }, []);

  const removeStylePreset = useCallback((id: string) => {
    setStylePresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const save = useCallback(async () => {
    try {
      setSaving(true);
      setSaveError(null);
      const result = await window.api.promptPresetsSave({ contentPresets, stylePresets });
      if (!result.success) {
        setSaveError(result.error || 'Failed to save');
        return false;
      }
      return true;
    } catch {
      setSaveError('Failed to save prompt presets');
      return false;
    } finally {
      setSaving(false);
    }
  }, [contentPresets, stylePresets]);

  const reset = useCallback(async () => {
    try {
      setSaving(true);
      const result = await window.api.promptPresetsReset();
      setContentPresets(result.contentPresets);
      setStylePresets(result.stylePresets);
    } catch {
      setSaveError('Failed to reset presets');
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    contentPresets,
    stylePresets,
    loading,
    saving,
    saveError,
    updateContentPreset,
    addContentPreset,
    removeContentPreset,
    updateStylePreset,
    addStylePreset,
    removeStylePreset,
    save,
    reset,
  };
}
