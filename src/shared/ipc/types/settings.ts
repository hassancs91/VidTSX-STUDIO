import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from './render';
import type { ExportEngineId } from '../../studio/export-engines';

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
  /** Studio export engine the Export dialog starts on (docs/export-engines-plan.md D2). */
  renderDefaultExportEngine: ExportEngineId;
  /** Studio Export dialog defaults (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md Phase 2):
   *  a resolution preset id and a quality level from `src/shared/render-presets.ts`.
   *  A project's own last choice wins over these. */
  renderDefaultExportResolution: string;
  renderDefaultExportQuality: string;
  /** Opt-in crash reporting consent (off by default). */
  crashReportingEnabled: boolean;
  /** False when the build has no crash-reporting DSN baked in — the toggle is inert. */
  crashReportingAvailable: boolean;
  /** True once the user has answered the first-launch consent prompt (or touched the
   *  Settings toggle). The prompt shows only while this is false. */
  crashReportingPrompted: boolean;
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

export interface SettingsSetRenderDefaultExportEngineRequest {
  exportEngine: ExportEngineId;
}

export interface SettingsSetRenderDefaultExportEngineResponse {
  success: boolean;
  error?: string;
}

export interface SettingsSetRenderDefaultExportOutputRequest {
  resolution: string;
  quality: string;
}

export interface SettingsSetRenderDefaultExportOutputResponse {
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
