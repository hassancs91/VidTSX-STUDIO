import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from './render';

// ─── Settings operations ───
// Settings operations
export interface SettingsGetResponse {
  outputFolder: string;
  aiModelsFolder: string;
  whisperModel: string;
  renderTimeoutSeconds: number;
  renderDefaultCpuUsage: RenderCpuUsage;
  renderDefaultGpuBackend: RenderGpuBackend;
  renderDefaultHardwareAcceleration: RenderHardwareAcceleration;
  /** Opt-in crash reporting consent (off by default). */
  crashReportingEnabled: boolean;
  /** False when the build has no crash-reporting DSN baked in — the toggle is inert. */
  crashReportingAvailable: boolean;
}

export interface SettingsSetOutputFolderRequest {
  path: string;
}

export interface SettingsSetOutputFolderResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetWhisperModelRequest {
  modelId: string;
}

export interface SettingsSetWhisperModelResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetAiModelsFolderRequest {
  path: string;
}

export interface SettingsSetAiModelsFolderResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetRenderTimeoutRequest {
  seconds: number;
}

export interface SettingsSetRenderTimeoutResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetRenderDefaultCpuUsageRequest {
  cpuUsage: RenderCpuUsage;
}

export interface SettingsSetRenderDefaultCpuUsageResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetRenderDefaultGpuBackendRequest {
  gpuBackend: RenderGpuBackend;
}

export interface SettingsSetRenderDefaultGpuBackendResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetRenderDefaultHardwareAccelerationRequest {
  hardwareAcceleration: RenderHardwareAcceleration;
}

export interface SettingsSetRenderDefaultHardwareAccelerationResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetCrashReportingRequest {
  enabled: boolean;
}

export interface SettingsSetCrashReportingResponse {
  success: boolean;
  error?: string;
}
