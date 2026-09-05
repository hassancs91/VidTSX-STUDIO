import { useState, useEffect, useCallback } from 'react';
import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from '@shared/ipc/types';
import { DEFAULT_EXPORT_ENGINE_ID, type ExportEngineId } from '@shared/studio/export-engines';

interface SettingsState {
  outputFolder: string;
  aiModelsFolder: string;
  whisperModel: string;
  renderTimeoutSeconds: number;
  renderDefaultCpuUsage: RenderCpuUsage;
  renderDefaultGpuBackend: RenderGpuBackend;
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  renderDefaultExportEngine: ExportEngineId;
  crashReportingEnabled: boolean;
  crashReportingAvailable: boolean;
  loading: boolean;
  error: string | null;
}

export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    outputFolder: '',
    aiModelsFolder: '',
    whisperModel: 'base',
    renderTimeoutSeconds: 600,
    renderDefaultCpuUsage: 'medium',
    renderDefaultGpuBackend: 'swangle',
    renderDefaultHardwareAcceleration: 'if-possible',
    renderDefaultExportEngine: DEFAULT_EXPORT_ENGINE_ID,
    crashReportingEnabled: false,
    crashReportingAvailable: false,
    loading: true,
    error: null,
  });

  const loadSettings = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await window.api.settingsGet();
      setState({
        outputFolder: result.outputFolder,
        aiModelsFolder: result.aiModelsFolder,
        whisperModel: result.whisperModel,
        renderTimeoutSeconds: result.renderTimeoutSeconds,
        renderDefaultCpuUsage: result.renderDefaultCpuUsage,
        renderDefaultGpuBackend: result.renderDefaultGpuBackend,
        renderDefaultHardwareAcceleration: result.renderDefaultHardwareAcceleration,
        renderDefaultExportEngine: result.renderDefaultExportEngine ?? DEFAULT_EXPORT_ENGINE_ID,
        crashReportingEnabled: result.crashReportingEnabled,
        crashReportingAvailable: result.crashReportingAvailable,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load settings',
      }));
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const setOutputFolder = useCallback(async (path: string) => {
    try {
      const result = await window.api.settingsSetOutputFolder({ path });
      if (result.success) {
        setState((prev) => ({ ...prev, outputFolder: path }));
        return true;
      } else {
        setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
        return false;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setAiModelsFolder = useCallback(async (folderPath: string) => {
    try {
      const result = await window.api.settingsSetAiModelsFolder({ path: folderPath });
      if (result.success) {
        setState((prev) => ({ ...prev, aiModelsFolder: folderPath }));
        return true;
      } else {
        setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
        return false;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const browseAiModelsFolder = useCallback(async () => {
    try {
      const result = await window.api.dialogOpenFolder();
      if (!result.canceled && result.folderPath) {
        await setAiModelsFolder(result.folderPath);
        return result.folderPath;
      }
      return null;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to open folder dialog',
      }));
      return null;
    }
  }, [setAiModelsFolder]);

  const setRenderDefaultCpuUsage = useCallback(async (cpuUsage: RenderCpuUsage) => {
    try {
      const result = await window.api.settingsSetRenderDefaultCpuUsage({ cpuUsage });
      if (result.success) {
        setState((prev) => ({ ...prev, renderDefaultCpuUsage: cpuUsage }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setRenderDefaultGpuBackend = useCallback(async (gpuBackend: RenderGpuBackend) => {
    try {
      const result = await window.api.settingsSetRenderDefaultGpuBackend({ gpuBackend });
      if (result.success) {
        setState((prev) => ({ ...prev, renderDefaultGpuBackend: gpuBackend }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setRenderDefaultHardwareAcceleration = useCallback(async (hardwareAcceleration: RenderHardwareAcceleration) => {
    try {
      const result = await window.api.settingsSetRenderDefaultHardwareAcceleration({ hardwareAcceleration });
      if (result.success) {
        setState((prev) => ({ ...prev, renderDefaultHardwareAcceleration: hardwareAcceleration }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setRenderDefaultExportEngine = useCallback(async (exportEngine: ExportEngineId) => {
    try {
      const result = await window.api.settingsSetRenderDefaultExportEngine({ exportEngine });
      if (result.success) {
        setState((prev) => ({ ...prev, renderDefaultExportEngine: exportEngine }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setCrashReportingEnabled = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.api.settingsSetCrashReporting({ enabled });
      if (result.success) {
        setState((prev) => ({ ...prev, crashReportingEnabled: enabled }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setRenderTimeoutSeconds = useCallback(async (seconds: number) => {
    try {
      const result = await window.api.settingsSetRenderTimeout({ seconds });
      if (result.success) {
        setState((prev) => ({ ...prev, renderTimeoutSeconds: seconds }));
        return true;
      }
      setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
      return false;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const setWhisperModel = useCallback(async (modelId: string) => {
    try {
      const result = await window.api.settingsSetWhisperModel({ modelId });
      if (result.success) {
        setState((prev) => ({ ...prev, whisperModel: modelId }));
        return true;
      } else {
        setState((prev) => ({ ...prev, error: result.error || 'Failed to save' }));
        return false;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      }));
      return false;
    }
  }, []);

  const browseOutputFolder = useCallback(async () => {
    try {
      const result = await window.api.dialogOpenFolder();
      if (!result.canceled && result.folderPath) {
        await setOutputFolder(result.folderPath);
        return result.folderPath;
      }
      return null;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to open folder dialog',
      }));
      return null;
    }
  }, [setOutputFolder]);

  return {
    outputFolder: state.outputFolder,
    aiModelsFolder: state.aiModelsFolder,
    whisperModel: state.whisperModel,
    renderTimeoutSeconds: state.renderTimeoutSeconds,
    renderDefaultCpuUsage: state.renderDefaultCpuUsage,
    renderDefaultGpuBackend: state.renderDefaultGpuBackend,
    renderDefaultHardwareAcceleration: state.renderDefaultHardwareAcceleration,
    renderDefaultExportEngine: state.renderDefaultExportEngine,
    crashReportingEnabled: state.crashReportingEnabled,
    crashReportingAvailable: state.crashReportingAvailable,
    loading: state.loading,
    error: state.error,
    setOutputFolder,
    setAiModelsFolder,
    setWhisperModel,
    setRenderTimeoutSeconds,
    setRenderDefaultCpuUsage,
    setRenderDefaultGpuBackend,
    setRenderDefaultHardwareAcceleration,
    setRenderDefaultExportEngine,
    setCrashReportingEnabled,
    browseOutputFolder,
    browseAiModelsFolder,
    reload: loadSettings,
  };
}
